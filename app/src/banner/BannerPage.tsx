import type { FC } from 'react';

import { useForm } from 'react-hook-form';
import { generatePrompts, generateBanner } from 'wasp/client/operations';

const BannerPage: FC = () => {

  const { register, handleSubmit, formState: { errors } } = useForm();
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
        {/* begin AI-powered Todo List */}
        <div className='my-8 border rounded-3xl border-gray-900/10 dark:border-gray-100/10'>
          <div className='sm:w-[90%] md:w-[70%] lg:w-[50%] py-10 px-6 mx-auto my-8 space-y-10'>
          <form
            className='flex flex-col gap-4'
            onSubmit={handleSubmit(async (data) => {
              try {
                await generatePrompts({ initialPrompt: data.prompt });
              } catch (error) {
                console.error('Failed to generate prompts:', error);
              }
            })}
          >
            <div>
              <label htmlFor='prompt' className='block text-sm font-medium text-gray-700 dark:text-gray-200'>
                Enter your prompt
              </label>
              <input
                {...register('prompt', { required: true })}
                type='text'
                id='prompt'
                className='mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-yellow-500 focus:outline-none focus:ring-yellow-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white'
                placeholder='Enter a prompt to generate variations...'
              />
              {errors.prompt && (
                <span className='text-sm text-red-600'>This field is required</span>
              )}
            </div>
            <button
              type='submit'
              className='inline-flex justify-center rounded-md border border-transparent bg-yellow-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2'
            >
              Generate Prompt Variations
            </button>

          </form>
          <button
            onClick={async () => {
              try {
                await generateBanner({ prompt: 'test' });
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
        {/* end AI-powered Todo List */}
      </div>
    </div>
  );
}

export default BannerPage
