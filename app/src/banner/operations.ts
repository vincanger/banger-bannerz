import type { BrandTheme, GeneratedImageData, User } from 'wasp/entities';
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
} from 'wasp/server/operations';

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

export const generatePromptFromTitle: GeneratePromptFromTitle<{ title: string, isUsingBrandSettings: boolean }, { promptData: { prompt: string; style: string; mood: string; lighting: string }[] }> = async ({ title, isUsingBrandSettings }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  if (openai instanceof Error) {
    throw openai;
  }

  // const imageParts = 3
  // const backgroundColor = 'black'
  // const centerInfo = 'a minimalist series of lines, almost like a sound wave, creates a subtle mountain range design.';
  // const imagePromptExample = `A striking image with a ${backgroundColor} background split in ${imageParts.toString()}, where in the center, ${centerInfo}. The details in the center third fade out as the reach the other two thirds of the image.`

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an expert blog and social media image prompt engineer. You will be given a title or topic and your job is to create different image prompts in a single sentence that fit the title or topic. Do not include any mention of text, words, brands, or logos, as you will be penalized if you do. The prompts should not add text within the image.`,
      },
      {
        role: 'user',
        content: `Please create three different image prompts for the center part of an image for a social media or blog post with the title: ${title}. Make them obviously relate to the title, so that the image is easy to understand. Do not make them too abstract. Only return the prompt for the center content of the image. Do not include information about the image style, mood, or lighting.  Do not include any mention of text, words, brands, or logos, as you will be penalized if you do.`,
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
                    style: {
                      type: 'string',
                      description: 'The artistic style applied',
                      enum: Object.values(ImageStyle),
                    },
                    mood: {
                      type: 'string',
                      description: 'The emotional tone',
                      enum: Object.values(ImageMood),
                    },
                    lighting: {
                      type: 'string',
                      description: 'The lighting conditions',
                      enum: Object.values(ImageLighting),
                    },
                  },
                  required: ['prompt', 'style', 'mood', 'lighting'],
                },
              },
            },
            required: ['prompts'],
          },
        },
      },
    ],
    tool_choice: { type: 'function', function: { name: 'generateImagePrompts' } },
  });

  const result = completion.choices[0].message.tool_calls?.[0].function.arguments;
  console.log('result: ', completion.choices[0].message.tool_calls?.[0].function);
  if (!result) {
    throw new HttpError(500, 'Bad response from OpenAI');
  }

  return JSON.parse(result);
};

export const generatePrompts: GeneratePrompts<{ initialPrompt: string }, PromptVariations> = async ({ initialPrompt }, context) => {
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
                description: 'Array of four prompt variations',
                items: {
                  type: 'object',
                  properties: {
                    prompt: {
                      type: 'string',
                      description: 'The modified prompt text',
                    },
                    style: {
                      type: 'string',
                      description: 'The artistic style applied',
                      enum: Object.values(ImageStyle),
                    },
                    mood: {
                      type: 'string',
                      description: 'The emotional tone',
                      enum: Object.values(ImageMood),
                    },
                    lighting: {
                      type: 'string',
                      description: 'The lighting conditions',
                      enum: Object.values(ImageLighting),
                    },
                  },
                  required: ['prompt', 'style', 'mood', 'lighting'],
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

  // example output: {"variations":[{"prompt":"a turtle riding a vibrant skateboard in a busy urban setting with graffiti-filled walls","style":"digital art","mood":"energetic","lighting":"neon"},{"prompt":"a turtle gracefully riding a skateboard on a serene beach at sunset","style":"watercolor","mood":"peaceful","lighting":"soft"},{"prompt":"a realistic depiction of a turtle balancing skillfully on a skateboard in a sunlit park","style":"photorealistic","mood":"bright","lighting":"natural"}]}
  const gptArgs = completion?.choices[0]?.message?.tool_calls?.[0]?.function.arguments;

  if (!gptArgs) {
    throw new HttpError(500, 'Bad response from OpenAI');
  }

  console.log('gpt function call arguments: ', gptArgs);

  return JSON.parse(gptArgs);
};

export const generateBanner: GenerateBanner<{ centerInfoPrompts: string[]; useBrandSettings?: boolean; useBrandColors?: boolean }, GeneratedImageData[]> = async (
  { centerInfoPrompts, useBrandSettings, useBrandColors },
  context
) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  let colorPalette = null;
  let brandTheme: BrandTheme | null = null;
  if (useBrandColors) {
    brandTheme = await context.entities.BrandTheme.findFirst({ where: { userId: context.user.id } });
    colorPalette = brandTheme?.colorScheme.map((color) => ({ color_hex: color }));
  }

  const centerInfoPromptsWithoutPunctuation = centerInfoPrompts.map(prompt => prompt.endsWith('.') ? prompt.slice(0, -1) : prompt);

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
    imageMoods = brandTheme.mood?.length ? [
      ...brandTheme.mood,
      ...getRandomElements(
        Object.values(ImageMood).filter(m => !brandTheme!.mood.includes(m)),
        Math.max(0, 3 - brandTheme.mood.length)
      )
    ] : imageMoods;

    imageLightings = brandTheme.lighting?.length ? [
      ...brandTheme.lighting,
      ...getRandomElements(
        Object.values(ImageLighting).filter(l => !brandTheme!.lighting.includes(l)), 
        Math.max(0, 3 - brandTheme.lighting.length)
      )
    ] : imageLightings;

    imageStyles = brandTheme.preferredStyles?.length ? [
      ...brandTheme.preferredStyles,
      ...getRandomElements(
        Object.values(ImageStyle).filter(s => !brandTheme!.preferredStyles.includes(s)),
        Math.max(0, 3 - brandTheme.preferredStyles.length) 
      )
    ] : imageStyles;
  }

  const generateSingleBanner = async ({index, userId, centerInfoPrompt}: {index: number, userId: string, centerInfoPrompt: string}) => {
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
            ...(colorPalette ? { color_palette: { members: colorPalette } } : undefined),
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
          prompt: imageData.prompt,
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
    return await Promise.all(centerInfoPromptsWithoutPunctuation.map((prompt, index) => generateSingleBanner({index, userId, centerInfoPrompt: prompt})));
  } catch (error: any) {
    throw new HttpError(500, `Failed to generate banners: ${error.message}`);
  }
};

export const getRecentGeneratedImageData: GetRecentGeneratedImageData<void, GeneratedImageData[]> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  return await context.entities.GeneratedImageData.findMany({
    where: { userId: context.user.id },
    orderBy: { createdAt: 'desc' },
  });
};

export const getGeneratedImageDataById: GetGeneratedImageDataById<{ id: string }, GeneratedImageData> = async ({ id }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  return await context.entities.GeneratedImageData.findUniqueOrThrow({ where: { id, userId: context.user.id } });
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
