import type { GeneratedImageData, User } from 'wasp/entities';
import type { GenerateBanner, GeneratePrompts, GeneratePromptFromImage, GeneratePromptFromTitle, GetRecentGeneratedImageData } from 'wasp/server/operations';

import axios from 'axios';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { HttpError } from 'wasp/server';
import { openai } from '../demo-ai-app/operations';

const IDEOGRAM_BASE_URL = 'https://api.ideogram.ai';

export enum IdeogramImageResolution {
  INSTAGRAM = 'RESOLUTION_1024_1024', // 1080:1080 = 1
  TWITTER = 'RESOLUTION_1280_720', // 1200:675 = 1.77 --> 16:9
  FACEBOOK = 'RESOLUTION_1344_704', // 1200:630 = 1.90
  HASHNODE = 'RESOLUTION_1344_704', // 1600:840 = 1.90
  LINKEDIN = 'RESOLUTION_1344_704', // 1200:627 = 1.91
  MEDIUM = 'RESOLUTION_1408_704', // 1500:750 = 2
  SUBSTACK = 'RESOLUTION_1408_704', // 1200:600 = 2
  DEVTO = 'RESOLUTION_1536_640', // 1000:420 = 2.38
}

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

export const generatePromptFromTitle: GeneratePromptFromTitle<{ title: string }, { prompts: string[] }> = async ({ title }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  if (openai instanceof Error) {
    throw openai;
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content:
          'You are an expert blog and social media image prompt engineer. You will be given a title or topic and your job is to create 3 different image prompts that would be suitable for that post, each with a completely different concept and approach. Consider marketing best practices and create engaging, visually striking descriptions. Do not include any text generation in the prompts.',
      },
      { role: 'user', content: `Please create 3 different image prompt concepts for a social media or blog post with the title: "${title}"` },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'generateImagePrompts',
          description: 'Generates 3 different image prompt concepts',
          parameters: {
            type: 'object',
            properties: {
              prompts: {
                type: 'array',
                description: 'Array of 3 different image prompt concepts',
                items: {
                  type: 'string',
                  description: 'The actual image generation prompt',
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
                      enum: ['photorealistic', 'digital art', 'oil painting', 'watercolor', 'illustration', 'pencil sketch', '3D render', 'pop art', 'minimalist'],
                    },
                    mood: {
                      type: 'string',
                      description: 'The emotional tone',
                      enum: ['dramatic', 'peaceful', 'energetic', 'mysterious', 'whimsical', 'dark', 'bright', 'neutral'],
                    },
                    lighting: {
                      type: 'string',
                      description: 'The lighting conditions',
                      enum: ['natural', 'studio', 'dramatic', 'soft', 'neon', 'dark', 'bright', 'cinematic'],
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

export const generateBanner: GenerateBanner<{ prompt: string; seed?: number }, GeneratedImageData> = async ({ prompt, seed }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const brandTheme = await context.entities.BrandTheme.findFirst({ where: { userId: context.user.id } });
  const colorPalette = brandTheme?.colorScheme.map((color) => ({ color_hex: color }));

  console.log('colorPalette: ', colorPalette);
  // prompt =
  //   'A stylized, abstract representation of form-building blocks stacking up like a 3D puzzle. Each block is labeled with React Hook Form, Zod, and Shadcn, with neon lights illuminating the blocks, symbolizing the synergy and ease of building complex forms.';
  // seed = 1713204812;

  try {
    const response = await axios.post(
      `${IDEOGRAM_BASE_URL}/generate`,
      {
        image_request: {
          prompt,
          model: 'V_2',
          magic_prompt_option: 'OFF',
          resolution: IdeogramImageResolution.DEVTO,
          color_palette: {
            members: colorPalette || undefined,
          },
          // Todo: add seed input
          seed,
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

    console.log('imageData: ', imageData);

    return await context.entities.GeneratedImageData.create({
      data: {
        url: imageData.url,
        prompt: imageData.prompt,
        seed: imageData.seed,
        style: imageData.style_type,
        resolution: imageData.resolution,
        user: {
          connect: {
            id: context.user.id,
          },
        },
      },
    });

    // {
    //   "created": "2000-01-23T04:56:07Z",
    //   "data": [
    //     {
    //       "prompt": "A serene tropical beach scene. Dominating the foreground are tall palm trees with lush green leaves, standing tall against a backdrop of a sandy beach. The beach leads to the azure waters of the sea, which gently kisses the shoreline. In the distance, there's an island or landmass with a silhouette of what appears to be a lighthouse or tower. The sky above is painted with fluffy white clouds, some of which are tinged with hues of pink and orange, suggesting either a sunrise or sunset.",
    //       "resolution": "1024x1024",
    //       "is_image_safe": true,
    //       "seed": 12345,
    //       "url": "https://ideogram.ai/api/images/direct/8YEpFzHuS-S6xXEGmCsf7g",
    //       "style_type": "REALISTIC"
    //     }
    //   ]
    // }
  } catch (error: any) {
    console.error('Failed to generate banner:', error.message);
    throw new HttpError(500, `Failed to generate banner: ${error.message}`);
  }
};

export const getRecentGeneratedImageData: GetRecentGeneratedImageData<void, GeneratedImageData[]> = async (_args, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return await context.entities.GeneratedImageData.findMany({ where: { userId: context.user.id, createdAt: { gt: last24Hours } } });
};
