import type { User } from "wasp/entities";
import type { GenerateBanner, GeneratePrompts } from "wasp/server/operations";

import axios from "axios";
import { HttpError } from "wasp/server";
import { openai } from "../demo-ai-app/operations";

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

export const generatePrompts: GeneratePrompts<{ initialPrompt: string }, void> = async ({ initialPrompt }, context) => {
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
        content: 'You are an expert image prompt engineer. You will be given an initial prompt and your job is to create three creative variations of that prompt in different artistic styles and with different properties to generate unique and interesting images.',
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
          description: 'Generates three variations of the initial prompt in different styles',
          parameters: {
            type: 'object',
            properties: {
              variations: {
                type: 'array',
                description: 'Array of three prompt variations',
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
                      enum: ['photorealistic', 'digital art', 'oil painting', 'watercolor', 'pencil sketch', '3D render', 'pop art', 'minimalist'],
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
                    }
                  },
                  required: ['prompt', 'style', 'mood', 'lighting']
                }
              }
            },
            required: ['variations']
          }
        }
      }
    ],
    tool_choice: {
      type: 'function',
      function: {
        name: 'generatePromptVariations'
      }
    },
    temperature: 1,
  });

  const gptArgs = completion?.choices[0]?.message?.tool_calls?.[0]?.function.arguments;

  if (!gptArgs) {
    throw new HttpError(500, 'Bad response from OpenAI');
  }

  console.log('gpt function call arguments: ', gptArgs);

}

export const generateBanner: GenerateBanner<{ prompt: string }, void> = async ({ prompt }, context) => {
  // if (!context.user) {
  //   throw new HttpError(401);
  // }

  prompt =
    'An expressive watercolor portrait of a bearded man with short brown hair in a striped sweater. The focus is on his right hand pressed against his forehead, showcasing an emotional moment. The background contains gentle washes of dark hues to create a peaceful, introspective atmosphere. Style watercolor. Mood peaceful. Lighting natural';

  try {
  const response = await axios.post(
    'https://api.ideogram.ai/generate',
    {
      image_request: {
        prompt,
        model: 'V_2',
        magic_prompt_option: 'OFF',
        resolution: IdeogramImageResolution.INSTAGRAM,
        color_palette: {
          members: [
            {
              color_hex: '#FFF4C4',

            },
            {
              color_hex: '#1A1A1A',
            },
          ],
        },
        // seed: 3245,
      },
    },
    {
      headers: {
        'Api-Key': process.env.IDEOGRAM_API_KEY,
        'Content-Type': 'application/json',
      },
    }
  );

    console.log(response.data);
  } catch (error) {
    console.error('Failed to generate banner:', error);
  }
}
