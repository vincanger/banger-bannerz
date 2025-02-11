import type { BrandTheme, GeneratedImageData, ImageTemplate, User } from 'wasp/entities';
import type {
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
  SaveBrandLogo,
} from 'wasp/server/operations';
import type { FileOutput } from 'replicate';

import axios from 'axios';
import fetch from 'node-fetch';
import FormData from 'form-data';
import Replicate from 'replicate';
import { v4 as uuidv4 } from 'uuid';
import { HttpError } from 'wasp/server';
import { writeFile, readFile, unlink } from 'node:fs/promises';
import OpenAI from 'openai';
import { getUploadFileSignedURLFromS3 } from '../file-upload/s3Utils';
import { colorNames } from './colorNames';
import { ImageStyle, ImageMood, ImageLighting, IdeogramImageResolution } from './imageSettings';

export const openai = setupOpenAI();
function setupOpenAI() {
  if (!process.env.OPENAI_API_KEY) {
    return new HttpError(500, 'OpenAI API key is not set');
  }
  return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

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

export const generatePromptFromTitle: GeneratePromptFromTitle<
  { title: string; imageTemplateId: ImageTemplate['id']; isUsingBrandSettings?: boolean; isUsingBrandColors?: boolean; numOutputs: number },
  { promptArray: { prompt: string }[] }
> = async ({ title, imageTemplateId, isUsingBrandSettings, isUsingBrandColors, numOutputs }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  if (openai instanceof Error) {
    throw openai;
  }

  const imageTemplate = await context.entities.ImageTemplate.findUniqueOrThrow({ where: { id: imageTemplateId } });
  if (!imageTemplate) {
    throw new HttpError(400, 'Image template not found');
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
          content: `You are an expert color palette engineer. You will be given a list of hex color codes and your job is to find the matching color names for each hex code from a provided list and return the names of these colors as a string.`,
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
    colorPalettePrompt = `The image prompt should use this color palette: ${colorPaletteNames}.`;
  }
  if (isUsingBrandSettings) {
    brandMoodPrompt = `The image should have a mood of ${brandTheme?.mood.join(', ')}.`;
  }

  console.log('numOutputs: ', numOutputs);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `
          You are an expert blog and social media image prompt engineer. 
          You will be given a title or topic along with an example prompt and an image style. 
          Your job is to create an image prompt based on the title or topic. 
          Use the example prompt and suggested image styles as a guide, but make sure to prioritize the title of the post as the main idea within the prompt. 
          DO NOT create complex, abstract, or conceptual prompts. 
          DO NOT include any mention of text, words, brands, or logos, as you will be penalized if you do. 
          The prompts should not add text within the image.`,
      },
      {
        role: 'user',
        content: `
          Create ${numOutputs === 1 ? 'an image prompt' : `${numOutputs} image prompts`} for a social media or blog post with the title: ${title}. 
          The image being generated is using a fine-tuned model with this style: ${imageTemplate.description ?? imageTemplate.name}. 
          ${colorPalettePrompt ? `. ${colorPalettePrompt}` : ''} 
          ${brandMoodPrompt ? `. ${brandMoodPrompt}` : ''}
          Here is the example prompt: ${imageTemplate.exampleImagePrompt}`,
      },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'generateImagePrompts',
          description: `Generates ${numOutputs === 1 ? `${numOutputs} image prompt` : `${numOutputs} image prompts`} for a social media or blog post`,
          parameters: {
            type: 'object',
            properties: {
              promptArray: {
                type: 'array',
                description: `an array of ${numOutputs === 1 ? '1 image generation prompt' : `${numOutputs} image generation prompts`}`,
                items: {
                  type: 'object',
                  properties: {
                    prompt: {
                      type: 'string',
                      description: 'the image generation prompt',
                    },
                  },
                },
              },
            },
            required: ['promptArray'],
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

export const getImageTemplates: GetImageTemplates<void, ImageTemplate[]> = async (_args, context) => {
  return await context.entities.ImageTemplate.findMany();
};

export const getImageTemplateById: GetImageTemplateById<{ id: string }, ImageTemplate> = async ({ id }, context) => {
  return await context.entities.ImageTemplate.findUniqueOrThrow({
    where: { id },
  });
};

type GeneratedImageDataWithTemplate = GeneratedImageData & { imageTemplate: ImageTemplate | null };

interface LoraInput {
  prompt: string;
  lora_weights: string;
  seed: number;

  go_fast?: boolean;
  guidance?: number;
  lora_scale?: number;
  megapixels?: string;
  num_outputs?: number;
  aspect_ratio?: string;
  output_format?: string;
  output_quality?: number;
  prompt_strength?: number;
  num_inference_steps?: number;
}

function createLoraInput(params: Required<Pick<LoraInput, 'prompt' | 'lora_weights' | 'seed'>> & Partial<LoraInput>): LoraInput {
  const LORA_DEFAULTS = {
    go_fast: true,
    guidance: 3,
    lora_scale: 1,
    megapixels: '1',
    num_outputs: 1,
    aspect_ratio: '21:9',
    output_format: 'webp',
    output_quality: 100,
    prompt_strength: 0.8,
    num_inference_steps: 32,
  } as const;

  return {
    ...LORA_DEFAULTS,
    ...params, // This will override any of the defaults if provided
  };
}

async function generateImageFromLora(params: { prompt: string; loraWeights: string; seed: number; aspectRatio?: string; numOutputs?: number }): Promise<FileOutput[]> {
  const input = createLoraInput({
    prompt: params.prompt,
    lora_weights: params.loraWeights,
    seed: params.seed,
    ...(params.aspectRatio && { aspect_ratio: params.aspectRatio }),
    ...(params.numOutputs && { num_outputs: params.numOutputs }),
  });

  const output = (await replicate.run('black-forest-labs/flux-dev-lora', { input })) as FileOutput[];

  return output;
}

function generateSeed(): number {
  return Math.floor(Math.random() * 2147483647) + 1;
}

export const generateBannerFromTemplate: GenerateBannerFromTemplate<
  {
    imageTemplateId: ImageTemplate['id'];
    userPrompt: string;
    postTopic?: string;
    aspectRatio?: string;
    numOutputs?: number;
    seed?: number;
  },
  GeneratedImageDataWithTemplate[]
> = async ({ imageTemplateId, userPrompt, numOutputs = 3, postTopic, aspectRatio = '21:9', seed }, context) => {
  if (!context.user) {
    throw new HttpError(401, 'User not found');
  }

  const imageTemplate = await context.entities.ImageTemplate.findUniqueOrThrow({ where: { id: imageTemplateId } });
  if (!imageTemplate.loraUrl) {
    throw new HttpError(400, 'Lora weights URL is required');
  }

  const combinedPrompt = `${imageTemplate.loraTriggerWord ? `${imageTemplate.loraTriggerWord}: ` : ''}${userPrompt}`;
  const useSeed = seed ?? generateSeed();

  const output = await generateImageFromLora({
    prompt: combinedPrompt,
    loraWeights: imageTemplate.loraUrl,
    seed: useSeed,
    aspectRatio,
    numOutputs,
  });

  const generatedImages = await Promise.all(
    output.map((file) =>
      context.entities.GeneratedImageData.create({
        data: {
          url: file.url().href,
          seed: useSeed,
          postTopic,
          userPrompt,
          style: `flux-dev-lora-${imageTemplate.loraUrl}`,
          resolution: aspectRatio,
          imageTemplate: {
            connect: { id: imageTemplate.id },
          },
          user: {
            connect: { id: context.user!.id },
          },
        },
        include: {
          imageTemplate: true,
        },
      })
    )
  );

  return generatedImages;
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

  // Find existing brand theme for user
  const existingBrandTheme = await context.entities.BrandTheme.findFirst({
    where: { userId: context.user.id },
  });

  // If exists, update it
  if (existingBrandTheme) {
    return await context.entities.BrandTheme.update({
      where: { id: existingBrandTheme.id },
      data: brandTheme,
    });
  }

  // If doesn't exist, create new
  return await context.entities.BrandTheme.create({
    data: {
      ...brandTheme,
      userId: context.user.id,
    },
  });
};

export const getBrandThemeSettings: GetBrandThemeSettings<void, BrandTheme | null> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  return await context.entities.BrandTheme.findFirst({ where: { userId: context.user.id } });
};

export const saveBrandLogo: SaveBrandLogo<
  { 
    fileName: string; 
    fileExtension: string; 
    fileType: string;
    base64Data: string;
  }, 
  void
> = async ({ fileName, fileExtension, fileType, base64Data }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  try {
    // Convert base64 to buffer
    const base64String = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const fileBuffer = Buffer.from(base64String, 'base64');

    const { uploadUrl, key } = await getUploadFileSignedURLFromS3({
      fileName: `${fileName}.${fileExtension}`,
      fileType,
      userInfo: context.user.id,
    });

    // Upload buffer to S3
    await axios.put(uploadUrl, fileBuffer, {
      headers: {
        'Content-Type': `image/${fileType}`,
      },
    });

    const region = process.env.AWS_S3_REGION;
    const bucketName = process.env.AWS_S3_FILES_BUCKET;
    const logoUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${key}`;

    await saveBrandThemeSettings({ brandTheme: { logoUrl } }, context);
  } catch (error: any) {
    console.error('Error saving brand logo:', error);
    throw new HttpError(500, `Failed to save brand logo: ${error.message}`);
  }
};

