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
  GenerateAndRefinePrompts,
  GetBannerIdeasFromTitle,
  GenerateAdditionalVisualElements,
} from 'wasp/server/operations';
import type { FileOutput } from 'replicate';
import type { Prisma } from '@prisma/client';
import type { DefaultArgs } from '@prisma/client/runtime/library';
import type { AuthUser } from 'wasp/auth';
import type { ChatCompletionTool, ChatCompletionToolChoiceOption } from 'openai/resources/index.mjs';

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

export type VisualElementPromptIdea = { visualElement: string; visualElementDescription?: string; isChecked?: boolean; isUserSubmitted?: boolean };

const styleGuidelines = `
- Avoid overly abstract concepts; aim for ideas that clearly illustrate the post's title in a way that can be directly translated into an image.
- Include objects in the proposed visual elements that reflect the post's title so the reader can quickly get a sense of what the post is about from the image. 
- Use general categories and common nouns over named entities and proper nouns.
- Each visual element concept/idea should include objects that can be easily depicted.
- A visual element concept/idea can include a range of one to three objects.
- Don't add words, text, text characters, brands, and logos to the image.
- Make sure the visual elements are varied and distinct from one another.
`;

export const getBannerIdeasFromTitle: GetBannerIdeasFromTitle<
  { title: string; imageTemplateId: ImageTemplate['id']; numOfVisualElementIdeas: number },
  { mainIdeas: string; visualElements: VisualElementPromptIdea[] }
> = async ({ title, imageTemplateId, numOfVisualElementIdeas = 10 }, context) => {
  if (openai instanceof Error) {
    throw openai;
  }

  const imageTemplate = await context.entities.ImageTemplate.findUniqueOrThrow({ where: { id: imageTemplateId } });
  if (!imageTemplate) {
    throw new HttpError(400, 'Image template not found');
  }

  const tools: ChatCompletionTool[] = [
    {
      type: 'function',
      function: {
        name: 'generatePromptIdeas',
        description: 'Generates image prompts for a social media or blog post',
        parameters: {
          type: 'object',
          properties: {
            mainIdeas: {
              type: 'array',
              items: {
                type: 'string',
                description: 'A main idea or message of the image',
              },
            },
            visualElements: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  visualElement: { type: 'string', description: 'A visual element idea that could be used within an image generation prompt to create a banner for the post' },
                  visualElementDescription: {
                    type: 'string',
                    description: 'A description of the visual element idea and reasoning for why the this visual element would be a good fit for the image style and the main ideas of the post',
                  },
                },
              },
            },
          },
          required: ['visualElements', 'mainIdeas'],
        },
      },
    },
  ];

  const tool_choice: ChatCompletionToolChoiceOption = { type: 'function', function: { name: 'generatePromptIdeas' } };

  // create an openai chat completion with function calling for the function generatePromptIdeas
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `
        You will be given a title of a social media or blog post.
        Your job is to brainstorm and return a list of ${numOfVisualElementIdeas} concepts and visual elements that could be used within an image generation prompt to create a banner for the post.
        First, you will think about this title to determine the main concepts and ideas of the post.
        Then, with the post's main ideas in mind, use the following style guidelines to propose ${numOfVisualElementIdeas} visual elements that could be used within an image generation prompt: ${styleGuidelines}
        `,
      },
      {
        role: 'user',
        content: `
        Here is the title of a social media or blog post. Title: ${title}.`,
      },
    ],
    tools,
    tool_choice,
  });

  const result = completion.choices[0].message.tool_calls?.[0].function.arguments;
  if (!result) {
    throw new HttpError(500, 'Bad response from OpenAI');
  }

  console.log('intermediate visual elements: ', JSON.parse(result));

  // call the openai chat completion endpoint again, this time with the visual elements and main ideas, and ask it to review the visual elements and return them all but edited to fit the style guidelines
  const reviewCompletion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `
        You are an expert social media and blog post image banner prompt engineer. 
        You will be given a list of visual elements and main ideas according to the title of a social media or blog post. 
        Your job is to review the visual elements to see if they fit the post and the following style guidelines: ${styleGuidelines}.
        If a visual element references an abstract concept, edit it to make it more specific or tangible (e.g. "an open toolbox with thoughts and questions coming out of it" -> "an open toolbox with question marks coming out of it").
        If a visual element contains words, text, text characters, brands, and logos, edit it to remove them and replace it with a real object.
        If a visual element references specific entity or proper noun, edit it to use general categories and common nouns.
        Return all ${numOfVisualElementIdeas} visual elements, whether you edited them or not.
        `,
      },
      {
        role: 'user',
        content: `Here are the visual elements and main ideas as a JSON object: ${result}.`,
      },
    ],
    tools,
    tool_choice,
  });

  const reviewResult = reviewCompletion.choices[0].message.tool_calls?.[0].function.arguments;
  if (!reviewResult) {
    throw new HttpError(500, 'Bad response from OpenAI');
  }
  console.log('review of visual elements: ', JSON.parse(reviewResult));
  return JSON.parse(reviewResult);
};

export const generateAdditionalVisualElements: GenerateAdditionalVisualElements<
  { visualElements: VisualElementPromptIdea[]; imageTemplateId: ImageTemplate['id']; title: string },
  { visualElements: VisualElementPromptIdea[] }
> = async ({ visualElements, imageTemplateId, title }, context) => {
  if (openai instanceof Error) {
    throw openai;
  }

  const imageTemplate = await context.entities.ImageTemplate.findUniqueOrThrow({ where: { id: imageTemplateId } });
  if (!imageTemplate) {
    throw new HttpError(400, 'Image template not found');
  }

  const approvedVisualElements = visualElements.filter((visualElement) => visualElement.isChecked);
  const numOfVisualElementIdeasToGenerate = 10 - approvedVisualElements.length;

  console.log('numOfVisualElementIdeasToGenerate: ', numOfVisualElementIdeasToGenerate);

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an expert social media and blog post image banner prompt engineer. 
        You will be given a title of a social media or blog post.
        You will also be given already reviewed visual elements and concepts that may be used within a generation prompt to create a banner image for the post.
        Your job is to return a list of ${numOfVisualElementIdeasToGenerate} new, distinct, and relevant visual elements and concepts that could be used within a generation prompt to create a banner image for the post.
        Use the following style guidelines to propose visual elements: ${styleGuidelines}
        Propose some visual elements that are simple and straightforward, and some that are more complex and abstract.
        Do not return any visual elements that are already in the list of reviewed visual elements.
        `,
      },
      {
        role: 'user',
        content: `
        Here is the title of a social media or blog post. Title: ${title}.
        Here are the already reviewed (approved or discarded) visual elements and concepts: ${visualElements.map((visualElement) => `${visualElement.visualElement}`).join('\n')}.`,
      },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'generatePromptIdeasFromVisualElements',
          description: 'Generates image prompts for a social media or blog post from a list of visual elements',
          parameters: {
            type: 'object',
            properties: {
              visualElements: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    visualElement: { type: 'string', description: 'A visual element of the image' },
                    visualElementDescription: {
                      type: 'string',
                      description: 'A description of the idea and reasoning for why the this visual element would be a good fit for the image style and the main ideas of the post',
                    },
                  },
                  required: ['visualElement', 'visualElementDescription'],
                },
              },
            },
            required: ['visualElements'],
          },
        },
      },
    ],
    tool_choice: { type: 'function', function: { name: 'generatePromptIdeasFromVisualElements' } },
  });

  const result = completion.choices[0].message.tool_calls?.[0].function.arguments;
  if (!result) {
    throw new HttpError(500, 'Bad response from OpenAI');
  }
  console.log('additional visual elements: ', JSON.parse(result));

  return JSON.parse(result);
};

type OperationsContext = {
  entities: {
    User: Prisma.UserDelegate<DefaultArgs>;
    ImageTemplate: Prisma.ImageTemplateDelegate<DefaultArgs>;
    BrandTheme: Prisma.BrandThemeDelegate<DefaultArgs>;
  };
  user?: AuthUser | undefined;
};

const generateColorPaletteStrFromHexCodes = async ({ hexCodes }: { hexCodes: string }): Promise<string> => {
  if (openai instanceof Error) {
    throw openai;
  }

  const colorPalette = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an expert color palette engineer. You will be given a list of hex color codes and your job is to find the matching color names for each hex code from a provided list and return the names of these colors as a string.`,
      },
      { role: 'user', content: `Here is the list of hex color codes: ${hexCodes}, and here is the list of available color names: ${colorNames}` },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'assembleFinalPrompts',
          description: 'Assembles the final image prompts for a social media or blog post',
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
    tool_choice: { type: 'function', function: { name: 'assembleFinalPrompts' } },
  });

  const colorPaletteResult = colorPalette.choices[0].message.tool_calls?.[0].function.arguments;
  if (!colorPaletteResult) {
    throw new HttpError(500, 'Bad response from OpenAI');
  }

  const colorPaletteNames = JSON.parse(colorPaletteResult).colorPalette;

  return colorPaletteNames;
};

const returnPromptsMatchingStyleGuidelines = async ({
  promptArray,
  title,
  mainIdeas,
  numOutputs,
  userSubmittedVisualElements,
}: {
  promptArray: { prompt: string }[];
  title: string;
  mainIdeas: string;
  numOutputs: number;
  userSubmittedVisualElements: VisualElementPromptIdea[];
}): Promise<{ mostSuitablePromptsArray: { prompt: string }[]; }> => {
  if (openai instanceof Error) {
    throw openai;
  }

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `You are an expert image generation prompt curator. You will be given a list of ${
          numOutputs * 2
        } image prompts, the title of a social media or blog post, the main ideas of the post, and the selected visual element ideas that were used to generate the prompts. Your job is to select the ${numOutputs} best prompts from the prompt array based on the title, main ideas of the post, and the selected visual element ideas while the following the provided style guidelines.
        Return prompts that are different from each other and do not include the same visual element ideas. Do not return any prompts that do not include a selected visual element idea.
        `,
      },
      {
        role: 'user',
        content: `Here is the list of image prompts: ${promptArray.map((p, index) => `- ${index + 1}. ${p.prompt}`).join('\n')}. 
        Here is the title of the post: ${title} and the main ideas of the post: ${mainIdeas}. 
        Here are the style guidelines: ${styleGuidelines}
        Here are the selected visual element ideas that were used to generate the prompts: ${userSubmittedVisualElements}`,
      },
    ],
    tools: [
      {
        type: 'function',
        function: {
          name: 'assembleFinalPrompts',
          description: 'Assembles the final image prompts for a social media or blog post',
          parameters: {
            type: 'object',
            properties: {
              mostSuitablePromptsArray: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    prompt: { type: 'string' },
                  },
                  required: ['prompt'],
                },
              },
            },
            required: ['mostSuitablePromptsArray'],
          },
        },
      },
    ],
    tool_choice: { type: 'function', function: { name: 'assembleFinalPrompts' } },
  });

  console.log('promptsMatchingStyleGuidelinesArray: ', completion.choices[0].message.tool_calls?.[0].function.arguments);

  const result = completion.choices[0].message.tool_calls?.[0].function.arguments;
  if (!result) {
    throw new HttpError(500, 'Bad response from OpenAI');
  }

  return JSON.parse(result);
};

export const generateAndRefinePrompts: GenerateAndRefinePrompts<
  { title: string; imageTemplateId: ImageTemplate['id']; isUsingBrandSettings: boolean; isUsingBrandColors: boolean; numOutputs: number; mainIdeas: string; visualElements: VisualElementPromptIdea[] },
  { mostSuitablePromptsArray: { prompt: string }[] }
> = async ({ title, imageTemplateId, isUsingBrandSettings, isUsingBrandColors, numOutputs, mainIdeas, visualElements }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  if (context.user.credits < numOutputs) {
    throw new HttpError(402, 'You do not have enough credits to generate images');
  }
  const userSubmittedVisualElements = visualElements.filter((visualElement) => visualElement.isUserSubmitted);
  const { promptArray } = await generatePromptFromTitle({ title, imageTemplateId, isUsingBrandSettings, isUsingBrandColors, numOutputs, mainIdeas, visualElements }, context);
  return await returnPromptsMatchingStyleGuidelines({ promptArray, title, mainIdeas, numOutputs, userSubmittedVisualElements });
};

export const generatePromptFromTitle: GeneratePromptFromTitle<
  { title: string; imageTemplateId: ImageTemplate['id']; isUsingBrandSettings?: boolean; isUsingBrandColors?: boolean; numOutputs: number; mainIdeas: string; visualElements: VisualElementPromptIdea[] },
  { promptArray: { prompt: string }[] }
> = async ({ title, imageTemplateId, isUsingBrandSettings, isUsingBrandColors, numOutputs, mainIdeas, visualElements }, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  if (!context.user.credits) {
    throw new HttpError(402, 'You do not have enough credits to generate images');
  }

  try {
    await context.entities.User.update({
      where: { id: context.user.id },
      data: { credits: { decrement: numOutputs } },
    });

    if (openai instanceof Error) {
      throw openai;
    }

    const imageTemplate = await context.entities.ImageTemplate.findUniqueOrThrow({ where: { id: imageTemplateId } });
    if (!imageTemplate) {
      throw new HttpError(400, 'Image template not found');
    }

    let brandTheme: BrandTheme | null = null;
    let colorPalettePrompt;
    let brandMoodPrompt = 'The image should have a mood of "whimsical", "energetic", or "dramatic"';
    if (isUsingBrandSettings || isUsingBrandColors) {
      brandTheme = await context.entities.BrandTheme.findFirst({ where: { userId: context.user.id } });
    }
    if (isUsingBrandColors) {
      const colorPaletteString = brandTheme?.colorScheme.join(', ');
      console.log('colorPaletteString from brandTheme: ', colorPaletteString);
      if (colorPaletteString) {
        const colorPaletteNames = await generateColorPaletteStrFromHexCodes({ hexCodes: colorPaletteString });
        console.log('colorPaletteNames: ', colorPaletteNames);
        colorPalettePrompt = `The image prompt should use this color palette: ${colorPaletteNames}.`;
      }
    }
    if (isUsingBrandSettings) {
      brandMoodPrompt = `The image should have a mood of ${brandTheme?.mood.join(', ')}.`;
    }

    numOutputs = numOutputs * 2;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `
          You are an expert blog and social media image prompt engineer. 
          You will be given a title of a post, along with the posts's main concepts, some suggested visual elements, and an example prompt based on the image style. 
          Your job is to create image generation prompts to accompany the post by following these style guidelines: ${styleGuidelines}
          All prompts should include at least one of the visual elements from the provided list.
          Use the example prompt as a guide for how to formulate the prompts. `,
        },
        {
          role: 'user',
          content: `
          Create ${numOutputs === 1 ? 'an image prompt' : `${numOutputs} image prompts`} for a social media or blog post with the title: ${title}.
          Use this brainstorming list of the post's main concepts and visual elements to create the prompts: ${mainIdeas} ${visualElements
            .map((visualElement) => `${visualElement.visualElement}: ${visualElement.visualElementDescription ?? ''}`)
            .join('\n')}.
          ${colorPalettePrompt ? `. ${colorPalettePrompt}` : ''} 
          ${brandMoodPrompt ? `. ${brandMoodPrompt}` : ''}
          Here is the image style being generated: ${imageTemplate.description ?? imageTemplate.name}.
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
  } catch (error: any) {
    if (!!context.user && error?.statusCode !== 402) {
      await context.entities.User.update({
        where: { id: context.user.id },
        data: { credits: { increment: numOutputs } },
      });
    }
    throw error;
  }
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

  let combinedPrompt = `${imageTemplate.loraTriggerWord ? `${imageTemplate.loraTriggerWord}, ` : ''}${userPrompt}`;
  if (imageTemplate.name === 'pin art') {
    combinedPrompt = `${imageTemplate.loraTriggerWord}, an eye-level view, ${userPrompt}`;
  }
  const useSeed = seed ?? generateSeed();

  console.log('combinedPrompt: ', combinedPrompt);

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

  const oneHourAgo = new Date();
  oneHourAgo.setHours(oneHourAgo.getHours() - 1);

  return await context.entities.GeneratedImageData.findMany({
    where: { 
      userId: context.user.id,
      OR: [
        { createdAt: { gte: oneHourAgo } },
        { saved: true }
      ]
    },
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
