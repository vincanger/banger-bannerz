import type { GeneratedImageData, ImageTemplate } from 'wasp/entities';
import type { GeneratedImageDataWithTemplate } from './GenerateImagePrompt';

import { cn } from '../../client/cn';
import { FC, useState } from 'react';
import { routes } from 'wasp/client/router';
import { FaSync, FaEdit, FaExpand, FaSave } from 'react-icons/fa';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { saveGeneratedImageData } from 'wasp/client/operations';
import { toast } from 'react-hot-toast';

type ImageGridProps = {
  images: GeneratedImageDataWithTemplate[];
};

export const ImageGrid: FC<ImageGridProps> = ({ images }) => {
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);
  const navigate = useNavigate();

  const { id: imageId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const imagePromptImageId = searchParams.get('imageId');

  return (
    <>
      <div className='flex flex-col divide-y divide-gray-200'>
        {images.map((image, index) => (
          <div key={image.url + index} className={`flex items-center gap-4 p-4 hover:bg-gray-50 group ${imageId === image.id ? 'bg-yellow-50' : ''}`}>
            {/* Thumbnail */}
            <div className='relative w-24 h-24 flex-shrink-0'>
              <img src={image.url} alt={`Generated option ${index + 1}`} className='w-full h-full object-cover rounded-lg' />
            </div>

            {/* Prompt and Actions */}
            <div className='flex-grow flex items-center justify-between'>
              {/* Prompt with popover */}
              <div className='relative group/prompt'>
                <p className='text-sm text-gray-600 max-w-md truncate'>{image.userPrompt}</p>
                <div className='invisible group-hover/prompt:visible absolute left-0 top-full mt-2 p-2 bg-gray-800 text-white text-sm rounded-lg shadow-lg z-10 max-w-md'>{image.imageTemplate?.loraTriggerWord ? `${image.imageTemplate.loraTriggerWord}: ${image.userPrompt}` : image.userPrompt}</div>
              </div>

              {/* Actions */}
              <div className='flex gap-4'>
                <button
                  disabled={imagePromptImageId === image.id}
                  onClick={() => {
                    navigate(
                      routes.GenerateImagePromptRoute.build({
                        search: {
                          generateBy: 'prompt',
                          imageId: image.id,
                        },
                      })
                    );
                  }}
                  className={cn(
                    'flex flex-col items-center gap-1',
                    {
                    'opacity-50 cursor-not-allowed': imagePromptImageId === image.id,
                  })}
                  title='Edit Prompt'
                >
                  <div className='p-2 rounded-full bg-white text-gray-800 hover:bg-yellow-500 hover:text-white transition-colors duration-200'>
                    <FaEdit className='w-4 h-4' />
                  </div>
                  <span className='text-xs text-gray-600'>Edit Prompt</span>
                </button>
                <button
                  onClick={async () => {
                    try {
                      await saveGeneratedImageData({ id: image.id });
                      toast.success('Image saved successfully');
                    } catch (error) {
                      console.error('Failed to save image:', error);
                      toast.error('Failed to save image');
                    }
                  }}
                  disabled={image.saved}
                  className={cn(
                    'flex flex-col items-center gap-1',
                    {
                      'opacity-50 cursor-not-allowed': image.saved
                    }
                  )}
                  title={image.saved ? 'Image already saved' : 'Save Image'}
                >
                  <div className='p-2 rounded-full bg-white text-gray-800 hover:bg-yellow-500 hover:text-white transition-colors duration-200'>
                    <FaSave className='w-4 h-4' />
                  </div>
                  <span className='text-xs text-gray-600'>Save</span>
                </button>
                <button
                  onClick={() => {
                    /*TODO: Implement generate variations*/
                  }}
                  className='flex flex-col items-center gap-1'
                  title='Generate Variations'
                >
                  <div className='p-2 rounded-full bg-white text-gray-800 hover:bg-yellow-500 hover:text-white transition-colors duration-200'>
                    <FaSync className='w-4 h-4' />
                  </div>
                  <span className='text-xs text-gray-600'>Variations</span>
                </button>
                <button onClick={() => setEnlargedImage(image.url)} className='flex flex-col items-center gap-1' title='Enlarge Image'>
                  <div className='p-2 rounded-full bg-white text-gray-800 hover:bg-yellow-500 hover:text-white transition-colors duration-200'>
                    <FaExpand className='w-4 h-4' />
                  </div>
                  <span className='text-xs text-gray-600'>Enlarge</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Large image preview overlay */}
      {enlargedImage && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-75' onClick={() => setEnlargedImage(null)}>
          <div className='relative max-w-4xl max-h-[80vh] w-auto h-auto'>
            <img src={enlargedImage} alt='Preview' className='object-contain w-full h-full shadow-2xl rounded-lg' />
            <button onClick={() => setEnlargedImage(null)} className='absolute top-4 right-4 p-2 rounded-full bg-white text-gray-800 hover:bg-yellow-500 hover:text-white transition-colors duration-200'>
              ×
            </button>
          </div>
        </div>
      )}
    </>
  );
};
