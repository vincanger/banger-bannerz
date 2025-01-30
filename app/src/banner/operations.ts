import type { BrandTheme, GeneratedImageData, ImageTemplate, User } from 'wasp/entities';
import type {
  GenerateBanner,
  GeneratePrompts,
  GeneratePromptFromImage,
  GeneratePromptFromTitle,
  GetRecentGeneratedImageData,
  GetGeneratedImageDataById,
  GetImageProxy,
  RemoveObjectFromImage,
  SaveGeneratedImageData,
  SaveBrandThemeSettings,
  GetBrandThemeSettings,
  GenerateBannerFromTemplate,
  GetImageTemplates,
  GetImageTemplateById,
} from 'wasp/server/operations';
import type { FileOutput, Prediction } from 'replicate';

import axios from 'axios';
import fetch from 'node-fetch';
import FormData from 'form-data';
import Replicate from 'replicate';
import { v4 as uuidv4 } from 'uuid';
import { HttpError } from 'wasp/server';
import { writeFile, readFile, unlink } from 'node:fs/promises';
import { openai } from '../demo-ai-app/operations';
import { getUploadFileSignedURLFromS3 } from '../file-upload/s3Utils';
import { ImageStyle, ImageMood, ImageLighting, IdeogramImageResolution } from './imageSettings';
import { colorNames } from './colorNames';

const IDEOGRAM_BASE_URL = 'https://api.ideogram.ai';

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export type PromptVariations = { variations: { prompt: string; style: string; mood: string; lighting: string }[] };

export const generatePromptFromImage: GeneratePromptFromImage<{ base64Data: string; filename: string }, string> = async ({ base64Data, filename }, context) => {
  try {
    // Create buffer directly from base64 string (removing data URL prefix if present)
    const base64String = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64String, 'base64');

    const formData = new FormData();
    formData.append('image_file', buffer, {
      filename,
      contentType: `image/${filename.split('.').pop()}`,
    });

    const response = await fetch(`${IDEOGRAM_BASE_URL}/describe`, {
      method: 'POST',
      headers: {
        'Api-Key': process.env.IDEOGRAM_API_KEY!,
        ...formData.getHeaders(),
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API responded with status ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as { descriptions: { text: string }[] };
    if (!data) {
      throw new Error('No description or caption found in API response');
    }
    console.log('data: ', data);
    return data.descriptions[0].text;
  } catch (error: any) {
    console.error('Error:', error);
    throw new HttpError(500, `Failed to generate prompt from image: ${error.message}`);
  }
};

export const generatePromptFromTitle: GeneratePromptFromTitle<{ title: string; imageTemplate: ImageTemplate; isUsingBrandSettings?: boolean; isUsingBrandColors?: boolean }, { promptData: { prompt: string }[] }> = async (
  { title, imageTemplate, isUsingBrandSettings, isUsingBrandColors },
  context
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  if (openai instanceof Error) {
    throw openai;
  }

  let brandTheme: BrandTheme | null = null;
  let colorPalettePrompt;
  let brandMoodPrompt;
  if (isUsingBrandSettings || isUsingBrandColors) {
    brandTheme = await context.entities.BrandTheme.findFirst({ where: { userId: context.user.id } });
  }
  if (isUsingBrandColors) {
    const colorPaletteString = brandTheme?.colorScheme.join(', ');
    console.log('colorPaletteString from brandTheme: ', colorPaletteString);

    const colorPalette = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are an expert color palette engineer. You will be given a list of hex color codes and your job is to find the matching color names for each hex code from a provided list and return a string of the color palette.`,
        },
        { role: 'user', content: `Here is the list of hex color codes: ${colorPaletteString}, and here is the list of available color names: ${colorNames}` },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'generateColorPalette',
            description: 'Generates a string of the color palette that matches the provided list of hex color codes',
            parameters: {
              type: 'object',
              properties: {
                colorPalette: {
                  type: 'string',
                  description: 'The color palette string',
                },
              },
              required: ['colorPalette'],
            },
          },
        },
      ],
      tool_choice: { type: 'function', function: { name: 'generateColorPalette' } },
    });

    const colorPaletteResult = colorPalette.choices[0].message.tool_calls?.[0].function.arguments;
    if (!colorPaletteResult) {
      throw new HttpError(500, 'Bad response from OpenAI');
    }

    const colorPaletteNames = JSON.parse(colorPaletteResult).colorPalette;
    console.log('colorPaletteNames: ', colorPaletteNames);
    colorPalettePrompt = `The image prompt should have a color palette of ${colorPaletteNames}.`;
  }
  if (isUsingBrandSettings) {
    brandMoodPrompt = `The image should have a mood of ${brandTheme?.mood.join(', ')}.`;
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `
          You are an expert blog and social media image prompt engineer. 
          You will be given a title or topic along with an example prompt and an image style. 
          Your job is to create different image prompts strongly based on the title or topic. 
          Use the example prompt and suggested image styles as a close guide, but ultimately use the title/topic of the post as the main idea within the prompt. 
          DO NOT create complex or overly abstract prompts. 
          DO NOT include any mention of text, words, brands, or logos, as you will be penalized if you do. 
          The prompts should not add text within the image.`,
      },
      {
        role: 'user',
        content: `
          Please create three different image prompts for a social media or blog post with the title: ${title}. 
          The image being generated is using a LoRA in the style of ${imageTemplate.description ?? imageTemplate.name}. 
          ${colorPalettePrompt ? `. ${colorPalettePrompt}` : ''} 
          ${brandMoodPrompt ? `. ${brandMoodPrompt}` : ''} 
          Use the example prompt as a guide only, and make sure to prioritize the user provided information in your prompts such as title/topic, style, mood, and/or color palette. Do not include any mention of text, words, brands, or logos, as you will be penalized if you do. 
          Here is the example prompt: ${imageTemplate.exampleImagePrompt}`,
      },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'generateImagePrompts',
          description: 'Generates 3 different image prompt concepts for the center part of a social media or blog post',
          parameters: {
            type: 'object',
            properties: {
              promptData: {
                type: 'array',
                description: 'Array of 3 different image prompt concepts for the center part of an image',
                items: {
                  type: 'object',
                  properties: {
                    prompt: {
                      type: 'string',
                      description: 'The actual image generation prompt',
                    },
                  },
                  required: ['prompt'],
                },
              },
            },
            required: ['promptData'],
          },
        },
      },
    ],
    tool_choice: { type: 'function', function: { name: 'generateImagePrompts' } },
  });

  const result = completion.choices[0].message.tool_calls?.[0].function.arguments;
  console.log('result: ', result);
  if (!result) {
    throw new HttpError(500, 'Bad response from OpenAI');
  }

  return JSON.parse(result);
};

export const generatePrompts: GeneratePrompts<{ initialPrompt: string }, { variations: { prompt: string }[] }> = async ({ initialPrompt }, context) => {
  // if (!context.user) {
  //   throw new HttpError(401);
  // }

  if (openai instanceof Error) {
    throw openai;
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert image prompt engineer. You will be given an initial prompt and your job is to create three creative variations of that prompt in different artistic styles and with different properties to generate unique and interesting images. You will also return the initial prompt as the first variation along with its style, mood, and lighting.',
      },
      {
        role: 'user',
        content: `Please create three creative variations of this prompt in different styles: "${initialPrompt}"`,
      },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'generatePromptVariations',
          description: 'Generates four variations of the initial prompt in different styles and returns the initial prompt as the first variation.',
          parameters: {
            type: 'object',
            properties: {
              variations: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    prompt: {
                      type: 'string',
                      description: 'The variations of the initial prompt',
                    },
                  },
                },
              },
            },
            required: ['variations'],
          },
        },
      },
    ],
    tool_choice: {
      type: 'function',
      function: {
        name: 'generatePromptVariations',
      },
    },
    temperature: 1,
  });

  // example output {"promptVariations":[{"prompt":"a turtle riding a vibrant skateboard in a busy urban setting with graffiti-filled walls"},{"prompt":"a turtle gracefully riding a skateboard on a serene beach at sunset"},{"prompt":"a realistic depiction of a turtle balancing skillfully on a skateboard in a sunlit park"}]}
  const gptArgs = completion?.choices[0]?.message?.tool_calls?.[0]?.function.arguments;

  if (!gptArgs) {
    throw new HttpError(500, 'Bad response from OpenAI');
  }

  console.log('gpt function call arguments: ', gptArgs);

  return JSON.parse(gptArgs);
};

export const generateBanner: GenerateBanner<{ centerInfoPrompts: string[]; postTopic?: string; useBrandSettings?: boolean; useBrandColors?: boolean }, GeneratedImageData[]> = async (
  { centerInfoPrompts, postTopic, useBrandSettings, useBrandColors },
  context
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  let colorPalette = null;
  let brandTheme: BrandTheme | null = null;
  if (useBrandColors) {
    brandTheme = await context.entities.BrandTheme.findFirst({ where: { userId: context.user.id } });
    colorPalette = {
      members: brandTheme?.colorScheme.map((color) => ({ color_hex: color })) || [],
    };
  }

  const centerInfoPromptsWithoutPunctuation = centerInfoPrompts.map((prompt) => (prompt.endsWith('.') ? prompt.slice(0, -1) : prompt));

  const backgroundColor = 'black';
  const orientation = 'landscape';
  const secondPart = orientation === 'landscape' ? 'left' : 'top';
  const thirdPart = orientation === 'landscape' ? 'right' : 'bottom';

  const getRandomElements = <T>(array: T[], count: number): T[] => {
    return [...array].sort(() => Math.random() - 0.5).slice(0, count);
  };

  let imageMoods: string[] = getRandomElements(Object.values(ImageMood), 3);
  let imageStyles: string[] = getRandomElements(Object.values(ImageStyle), 3);
  let imageLightings: string[] = getRandomElements(Object.values(ImageLighting), 3);

  if (useBrandSettings && brandTheme) {
    imageMoods = brandTheme.mood?.length
      ? [
          ...brandTheme.mood,
          ...getRandomElements(
            Object.values(ImageMood).filter((m) => !brandTheme!.mood.includes(m)),
            Math.max(0, 3 - brandTheme.mood.length)
          ),
        ]
      : imageMoods;

    imageLightings = brandTheme.lighting?.length
      ? [
          ...brandTheme.lighting,
          ...getRandomElements(
            Object.values(ImageLighting).filter((l) => !brandTheme!.lighting.includes(l)),
            Math.max(0, 3 - brandTheme.lighting.length)
          ),
        ]
      : imageLightings;

    imageStyles = brandTheme.preferredStyles?.length
      ? [
          ...brandTheme.preferredStyles,
          ...getRandomElements(
            Object.values(ImageStyle).filter((s) => !brandTheme!.preferredStyles.includes(s)),
            Math.max(0, 3 - brandTheme.preferredStyles.length)
          ),
        ]
      : imageStyles;
  }

  const generateSingleBanner = async ({ index, userId, centerInfoPrompt }: { index: number; userId: string; centerInfoPrompt?: string }) => {
    const combinedImagePrompt = `A ${imageMoods[index]} ${imageStyles[index]} with ${orientation} orientation and a ${backgroundColor} background. In the center of the image, ${centerInfoPrompt}. The ${secondPart} and ${thirdPart} parts of the image are empty, leaving space for the center content to be the main focus of the image. The lighting is ${imageLightings[index]}.`;
    try {
      const response = await axios.post(
        `${IDEOGRAM_BASE_URL}/generate`,
        {
          image_request: {
            prompt: combinedImagePrompt,
            model: 'V_2',
            magic_prompt_option: 'OFF',
            resolution: IdeogramImageResolution.DEVTO,
            ...(colorPalette ? { color_palette: colorPalette } : undefined),
            // seed: seed ? seed + index : undefined,
          },
        },
        {
          headers: {
            'Api-Key': process.env.IDEOGRAM_API_KEY!,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.data?.data?.[0]?.url) {
        throw new Error('No image URL in response');
      }
      const imageData = response.data.data[0];

      return await context.entities.GeneratedImageData.create({
        data: {
          url: imageData.url,
          userPrompt: combinedImagePrompt,
          seed: imageData.seed,
          style: imageData.style_type,
          resolution: imageData.resolution,
          user: {
            connect: {
              id: userId,
            },
          },
        },
      });
    } catch (error: any) {
      console.error(`Failed to generate banner ${index + 1}:`, error.message);
      throw new HttpError(500, `Failed to generate banner ${index + 1}: ${error.message}`);
    }
  };

  const userId = context.user.id;

  try {
    return await Promise.all(centerInfoPromptsWithoutPunctuation.map((prompt, index) => generateSingleBanner({ index, userId, centerInfoPrompt: prompt })));
  } catch (error: any) {
    throw new HttpError(500, `Failed to generate banners: ${error.message}`);
  }
};

export const getImageTemplates: GetImageTemplates<void, ImageTemplate[]> = async (_args, context) => {
  return await context.entities.ImageTemplate.findMany();
};

export const getImageTemplateById: GetImageTemplateById<{ id: string }, ImageTemplate> = async ({ id }, context) => {
  return await context.entities.ImageTemplate.findUniqueOrThrow({
    where: { id },
  });
};

type GeneratedImageDataWithTemplate = GeneratedImageData & { imageTemplate: ImageTemplate | null };

export const generateBannerFromTemplate: GenerateBannerFromTemplate<{ imageTemplate: ImageTemplate; userPrompt: string; postTopic?: string; aspectRatio?: string }, GeneratedImageDataWithTemplate> = async (
  { imageTemplate, userPrompt, postTopic, aspectRatio },
  context
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const combinedPrompt = `${imageTemplate.loraTriggerWord ? `${imageTemplate.loraTriggerWord}: ` : ''}${userPrompt}`;

  // create a random number between 1 and 2^32-1 (2147483647) which is the max value for a 32-bit signed int aka Postgres integer
  const seed = Math.floor(Math.random() * 2147483647) + 1; // Max 32-bit signed int (2^31 - 1)
  const aspect_ratio = '21:9';
  const input = {
    seed,
    prompt: combinedPrompt,
    go_fast: true,
    guidance: 3,
    lora_scale: 1,
    megapixels: '1',
    num_outputs: 1,
    aspect_ratio,
    lora_weights: imageTemplate.loraUrl,
    output_format: 'webp',
    output_quality: 100,
    prompt_strength: 0.8,
    num_inference_steps: 32,
  };

  function onProgress(prediction: Prediction) {
    console.log({ prediction });
  }

  const [output] = (await replicate.run('black-forest-labs/flux-dev-lora', { input })) as FileOutput[];

  const fileUrl = output.url().href;
  console.log('raw fileOutput from replicate: ', await output.blob());
  console.log('fileUrl from replicate: ', fileUrl);

  return await context.entities.GeneratedImageData.create({
    data: {
      url: fileUrl,
      seed,
      postTopic,
      userPrompt: combinedPrompt,
      style: `flux-dev-lora-${imageTemplate.loraUrl}`,
      resolution: aspect_ratio,
      imageTemplate: {
        connect: { id: imageTemplate.id },
      },
      user: {
        connect: { id: context.user.id },
      },
    },
    include: {
      imageTemplate: true,
    },
  });
};

export const getRecentGeneratedImageData: GetRecentGeneratedImageData<void, GeneratedImageDataWithTemplate[]> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  return await context.entities.GeneratedImageData.findMany({
    where: { userId: context.user.id },
    include: {
      imageTemplate: true,
    },
    orderBy: { createdAt: 'desc' },
  });
};

export const getGeneratedImageDataById: GetGeneratedImageDataById<{ id: string }, GeneratedImageDataWithTemplate> = async ({ id }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  return await context.entities.GeneratedImageData.findUniqueOrThrow({
    where: { id, userId: context.user.id },
    include: {
      imageTemplate: true,
    },
  });
};

export const getImageProxy: GetImageProxy<{ url: string }, string> = async ({ url }, context) => {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch image');

    const arrayBuffer = await response.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString('base64');
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    return `data:${contentType};base64,${base64}`;
  } catch (error: any) {
    throw new Error(`Failed to proxy image: ${error.message}`);
  }
};

export const removeObjectFromImage: RemoveObjectFromImage<{ imageUrl: string; maskUrl: string }, string> = async ({ imageUrl, maskUrl }, context) => {
  // console.log('imageUrl: ', imageUrl);
  console.log('maskUrl: ', maskUrl);

  const maskFilename = uuidv4();
  const maskPath = `/tmp/${maskFilename}.png`;
  const maskData = maskUrl.replace(/^data:image\/\w+;base64,/, '');
  await writeFile(maskPath, Buffer.from(maskData, 'base64'));
  const maskBuffer = await readFile(maskPath);

  let output = await replicate.predictions.create({
    version: '0e3a841c913f597c1e4c321560aa69e2bc1f15c65f8c366caafc379240efd8ba',
    input: {
      mask: maskBuffer,
      image: imageUrl,
    },
  });

  await unlink(maskPath);

  const MAX_ATTEMPTS = 30; // 30 seconds timeout
  let attempts = 0;

  while (output.status === 'processing' || output.status === 'starting') {
    if (attempts >= MAX_ATTEMPTS) {
      throw new HttpError(408, 'Processing timeout exceeded');
    }

    await new Promise((resolve) => setTimeout(resolve, 1000));
    output = await replicate.predictions.get(output.id);
    attempts++;
  }

  if (output.status === 'succeeded') {
    console.log('output: ', output.output);
    return output.output;
  } else {
    throw new HttpError(500, `Prediction failed with status: ${output.status}`);
  }
};

export const saveGeneratedImageData: SaveGeneratedImageData<{ id: GeneratedImageData['id'] }, GeneratedImageData> = async ({ id }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const userInfo = context.user.id;

  const imageData = await context.entities.GeneratedImageData.findUniqueOrThrow({ where: { id, userId: context.user.id } });
  if (imageData.saved) {
    throw new HttpError(400, 'Image already saved');
  }

  // temporarily download image to local file
  const fileName = uuidv4();
  let imageType = imageData.url.split('.').pop();
  if (!imageType) {
    throw new HttpError(500, 'Failed to get image type');
  }
  imageType = imageType.split('?')[0];
  const filePath = `/tmp/${fileName}.${imageType}`;

  const initialImgResult = await axios.get(imageData.url, { responseType: 'arraybuffer' });
  await writeFile(filePath, initialImgResult.data);
  const fileBuffer = await readFile(filePath);

  const { uploadUrl, key } = await getUploadFileSignedURLFromS3({ fileName, fileType: imageType, userInfo });

  const res = await axios.put(uploadUrl, fileBuffer, {
    headers: {
      'Content-Type': `image/${imageType}`,
    },
  });

  if (res.status !== 200) {
    throw new HttpError(500, 'Failed to upload image to S3');
  }
  await unlink(filePath);

  const region = process.env.AWS_S3_REGION;
  const bucketName = process.env.AWS_S3_FILES_BUCKET;

  const publicUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;

  return await context.entities.GeneratedImageData.update({
    where: { id, userId: context.user.id },
    data: { saved: true, url: publicUrl },
  });
};

export const saveBrandThemeSettings: SaveBrandThemeSettings<{ brandTheme: Partial<BrandTheme> }, BrandTheme> = async ({ brandTheme }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  return await context.entities.BrandTheme.upsert({
    where: { id: brandTheme.id },
    update: brandTheme,
    create: {
      ...brandTheme,
      userId: context.user.id,
    },
  });
};

export const getBrandThemeSettings: GetBrandThemeSettings<void, BrandTheme> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  return await context.entities.BrandTheme.findFirstOrThrow({ where: { userId: context.user.id } });
};
