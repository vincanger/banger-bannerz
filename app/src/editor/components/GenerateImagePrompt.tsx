import type { FC } from 'react';

import Editor from '../Editor';
import { generatePromptFromTitle, generateBanner } from 'wasp/client/operations';
import { useState } from 'react';
import { ExampleImageUpload } from './ExampleImageUpload';
import { GeneratedImageData } from 'wasp/entities';
import { ImageGrid } from './ImageGrid';

export const GenerateImagePrompt: FC = () => {
  const [postTopic, setPostTopic] = useState('');
  const [exampleImagePrompt, setExampleImagePrompt] = useState('');
  const [generatedImages, setGeneratedImages] = useState<GeneratedImageData[]>([]);

  return (
    <Editor>
      <div className='mb-4'>
        <label htmlFor='prompt-title' className='block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2'>
          Title or Topic of Post
        </label>
        <input
          type='text'
          id='prompt-title'
          value={postTopic}
          onChange={(e) => setPostTopic(e.target.value)}
          className='w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-yellow-500 focus:outline-none focus:ring-yellow-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white'
          placeholder='Enter the title or topic of your post'
        />
      </div>

      <button
        onClick={async () => {
          try {
            const generatedPrompts = await generatePromptFromTitle({ title: postTopic });

            if (generatedPrompts.prompts.length > 0) {
              const generatedBanners = generatedPrompts.prompts.map((prompt) => generateBanner({ centerInfoPrompt: prompt }));

              const imageResults = await Promise.all(generatedBanners);
              setGeneratedImages(imageResults);
            }
          } catch (error) {
            console.error('Failed to generate prompt from title:', error);
          }
        }}
        disabled={!postTopic}
        className='w-full rounded bg-yellow-500 px-4 py-2 text-white hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed'
      >
        Generate Prompt from Title
      </button>


      {/* TODO: implement this */}
      <details className='mb-4'>
        <summary className='cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-200'>Use an example image as a guide?</summary>
        <div className='mt-2'>
          <ExampleImageUpload setExampleImagePrompt={setExampleImagePrompt} />
        </div>
      </details>

      {generatedImages.length > 0 && <ImageGrid images={generatedImages} />}
    </Editor>
  );
};

