import type { FC, Dispatch, SetStateAction } from 'react';

import { generatePromptFromImage } from 'wasp/client/operations';

interface ExampleImageUploadProps {
  setExampleImagePrompt: Dispatch<SetStateAction<string>>;
}

export const ExampleImageUpload: FC<ExampleImageUploadProps> = ({ setExampleImagePrompt }) => {
  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file); // This gives us the data URL format directly
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        }
      };
      reader.onerror = (error) => reject(error);
    });
  };

  try {
    const base64Data = await fileToDataUrl(file);
    const response = await generatePromptFromImage({
      base64Data,
      filename: file.name,
    });

      if (response) setExampleImagePrompt(response);
    } catch (error: any) {
      console.error('Failed to generate prompt from image:', error.message);
    }
};

  return (
    <div className='flex items-center gap-4'>
      <label className='text-sm font-medium text-gray-700 dark:text-gray-200'>
        Upload an image
      </label>
      <div className='flex items-center gap-4 rounded-md border-2 border-dashed border-gray-300 dark:border-gray-600 px-4 py-2'>
        <svg
          className='h-8 w-8 text-gray-400'
          stroke='currentColor'
          fill='none'
          viewBox='0 0 48 48'
          aria-hidden='true'
        >
          <path
            d='M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02'
            strokeWidth={2}
            strokeLinecap='round'
            strokeLinejoin='round'
          />
        </svg>
        <div className='flex items-center gap-4'>
          <label
            htmlFor='file-upload'
            className='relative cursor-pointer rounded-md font-medium text-yellow-500 hover:text-yellow-400'
          >
            <input id='file-upload' name='file-upload' type='file' accept='image/png, image/jpg, image/webp' onChange={handleImageUpload} />
          </label>
          <span className='text-xs text-gray-500 dark:text-gray-400'>
            PNG, JPG, or WebP
          </span>
        </div>
      </div>
    </div>
  );
};