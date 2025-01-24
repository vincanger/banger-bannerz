import type { FC } from 'react';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { generatePrompts, generateBanner } from 'wasp/client/operations';
import Editor from '../Editor';
import { ImageGrid } from './ImageGrid';
import { useParams } from 'react-router-dom';
import { GeneratedImageData } from 'wasp/entities';
import { useQuery, getGeneratedImageDataById, getRecentGeneratedImageData } from 'wasp/client/operations';
import { useAuth } from 'wasp/client/auth';
import { Link } from 'wasp/client/router';

export const EditImagePrompt: FC = () => {
  const { data: user } = useAuth();
  const { id } = useParams();
  const { data: imageData } = useQuery(getGeneratedImageDataById, { id: id as string }, { enabled: !!id });
  const { data: recentImages } = useQuery(getRecentGeneratedImageData, undefined, { enabled: !!user?.id });

  const [imagePromptData, setImagePromptData] = useState<GeneratedImageData | undefined>(undefined);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImageData[]>([]);

  useEffect(() => {
    if (!id && recentImages?.length && recentImages.length > 0) {
      setImagePromptData(recentImages?.[0]);
    } else if (id && imageData) {
      setImagePromptData(imageData);
    }
  }, [id, recentImages, imageData]);

  return (
    <Editor>
      {imagePromptData ? (
        <div className='mb-4'>
          <div className='mb-8 rounded-lg overflow-hidden shadow-lg'>
            <img src={imagePromptData?.url} alt='Selected image' className='w-full h-auto' />
          </div>
          <label htmlFor='image-prompt' className='block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2'>
            Edit Image Prompt
          </label>
          <textarea
            id='image-prompt'
            value={imagePromptData?.prompt || ''}
            onChange={(e) => setImagePromptData((prev) => ({ ...prev!, prompt: e.target.value }))}
            className='w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-yellow-500 focus:outline-none focus:ring-yellow-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white min-h-[100px]'
            placeholder='Edit the prompt to regenerate the image'
          />
          <button
            onClick={async () => {
              try {
                if (!imagePromptData) return;
                const newImage = await generateBanner({
                  centerInfoPrompt: imagePromptData.prompt,
                  seed: imagePromptData.seed,
                });
                setGeneratedImages((prev) => [newImage, ...prev]);
              } catch (error) {
                console.error('Failed to generate edited image:', error);
              }
            }}
            disabled={!imagePromptData?.prompt}
            className='mt-2 w-full rounded bg-yellow-500 px-4 py-2 text-white hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed'
          >
            Generate Edit
          </button>
          <Link to={`/image-overlay/:id`} params={{ id: imagePromptData.id }}>
            <button className='mt-2 w-full rounded bg-yellow-500 px-4 py-2 text-white hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed'>
              Generate Overlay
            </button>
          </Link>
        </div>
      ) : (
        <div className='mb-4'>
          <p>Loading...</p>
        </div>
      )}
      {generatedImages.length > 0 && <ImageGrid images={generatedImages} />}
    </Editor>
  );
};
