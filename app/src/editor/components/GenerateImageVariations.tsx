import type { FC } from 'react';
import type { GeneratedImageData } from 'wasp/entities';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { generatePrompts, generateBanner } from 'wasp/client/operations';


export const GenerateImageVariations: FC<{ prompt: string }> = ({ prompt }) => {
  const [newPrompt, setNewPrompt] = useState<string>(prompt);
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm();

  return (
    <>
      <form
        className='flex flex-col gap-4'
        onSubmit={handleSubmit(async (data) => {
        try {
          const promptVariations = await generatePrompts({ initialPrompt: data.prompt });

          const promptPromises = promptVariations.variations.map((variation) => {
            return generateBanner({
              centerInfoPrompts: [variation.prompt + '. The picture should be in the style of ' + variation.style + ' with a ' + variation.mood + ' mood and ' + variation.lighting + ' lighting.'],
            });
          });

          const promptResults = await Promise.all(promptPromises);
          console.log('promptResults: ', promptResults);
          const generatedImageVariations = promptResults.map((result) => {
            return result;
          });

          console.log('imageResults: ', generatedImageVariations);
          setImageUrls(generatedImageVariations.flatMap((variation) => variation.map((image) => image.url)));
        } catch (error) {
          console.error('Failed to generate prompts:', error);
        }
      })}
    >
      <div>
        <label htmlFor='prompt' className='block text-sm font-medium text-gray-700 dark:text-gray-200'>
          Enter your prompt
        </label>
        <textarea
          {...register('prompt', { required: true })}
          value={newPrompt}
          onChange={(e) => setNewPrompt(e.target.value)}
          id='prompt'
          className='mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-yellow-500 focus:outline-none focus:ring-yellow-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white'
          placeholder='Enter a prompt to generate variations...'
        />
        {errors.prompt && <span className='text-sm text-red-600'>This field is required</span>}
      </div>
      <button
        type='submit'
        className='inline-flex justify-center rounded-md border border-transparent bg-yellow-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2'
      >
        Generate Variations
        </button>
      </form>
      <div>
        {imageUrls.map((imageUrl) => (
          <img src={imageUrl} alt='Generated Image' key={imageUrl} />
        ))}
      </div>
    </>
  );
};

