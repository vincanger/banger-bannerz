import type { FC } from 'react';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ColorPicker } from '../editor/components/ColorPicker';
import { generatePrompts, generateBanner } from 'wasp/client/operations';
import { ExampleImageUpload } from '../editor/components/ExampleImageUpload';

const BannerPage: FC = () => {

  const [initialPrompt, setInitialPrompt] = useState<string>('');
  const [selectedColors, setSelectedColors] = useState<string[]>(['#000000']);

  const [imageUrls, setImageUrls] = useState<string[]>([]);


  return (
    <div className='py-10 lg:mt-10'>
      <div className='mx-auto max-w-7xl px-6 lg:px-8'>
        <div className='mx-auto max-w-4xl text-center'>
          <h2 className='mt-2 text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl dark:text-white'>
            <span className='text-yellow-500'>Banger</span> Bannerz
          </h2>
        </div>
        {/* <p className='mx-auto mt-6 max-w-2xl text-center text-lg leading-8 text-gray-600 dark:text-white'>
          This example app uses OpenAI's chat completions with function calling to return a structured JSON object. Try it out, enter your day's tasks, and let AI do the rest!
        </p> */}
        <div className='my-8 border rounded-3xl border-gray-900/10 dark:border-gray-100/10'>
          <div className='sm:w-[90%] md:w-[70%] lg:w-[50%] py-10 px-6 mx-auto my-8 space-y-10'>

            {/* <ExampleImageUpload setInitialPrompt={setInitialPrompt} /> */}

            <ColorPicker />

            <h2 className='text-xl font-semibold text-gray-900 dark:text-gray-100 mt-8 mb-4'>Images</h2>
            {imageUrls.map((url, index) => (
              <img key={index} src={url} alt={`Generated banner ${index + 1}`} />
            ))}
            <button
              onClick={async () => {
                try {
                  await generateBanner({ 
                    centerInfoPrompts: ['test'],
                  });
                } catch (error) {
                  console.error('Failed to generate banner:', error);
                }
              }}
              className='inline-flex justify-center rounded-md border border-transparent bg-yellow-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2'
            >
              Generate Banner
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default BannerPage
