import type { GeneratedImageDataWithTemplate } from './GenerateImagePage';
import type { GeneratedImageData } from 'wasp/entities';

import { cn } from '../../client/cn';
import { FC, useState } from 'react';
import { routes } from 'wasp/client/router';
import { FaHashtag, FaEdit, FaExpand, FaSave, FaDownload, FaExclamationTriangle, FaShare, FaTrash } from 'react-icons/fa';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { saveGeneratedImageData, createSharedImage, deleteGeneratedImageData } from 'wasp/client/operations';
import { toast } from 'react-hot-toast';

type ImageGridProps = {
  images: GeneratedImageDataWithTemplate[];
};

function getMinutesUntilDeletion(createdAt: Date): number {
  const now = new Date();
  const minutesLeft = 60 - (now.getTime() - createdAt.getTime()) / (1000 * 60);
  return Math.max(0, Math.round(minutesLeft));
}

export const ImageGrid: FC<ImageGridProps> = ({ images }) => {
  const [enlargedImage, setEnlargedImage] = useState<GeneratedImageData | null>(null);
  const [isImageStoring, setIsImageStoring] = useState<string | null>(null);
  const [isImageSharing, setIsImageSharing] = useState<string | null>(null);
  const [isImageDeleting, setIsImageDeleting] = useState<string | null>(null);
  const [deletedImageIds, setDeletedImageIds] = useState<string[]>([]);
  const navigate = useNavigate();

  const { id: imageId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const imagePromptImageId = searchParams.get('imageId');

  // Function to handle sharing an image
  const handleShareImage = async (image: GeneratedImageDataWithTemplate) => {
    try {
      setIsImageSharing(image.id);
      const { shareUrl } = await createSharedImage({ 
        generatedImageDataId: image.id,
        title: image.postTopic ?? undefined
      });
      
      // Copy the share URL to clipboard
      await navigator.clipboard.writeText(shareUrl);
      toast.success('Share link copied to clipboard!');
    } catch (error) {
      console.error('Failed to share image:', error);
      toast.error('Failed to share image');
    } finally {
      setIsImageSharing(null);
    }
  };

  // Function to handle deleting an image
  const handleDeleteImage = async (image: GeneratedImageDataWithTemplate) => {
    try {
      // Confirm deletion
      if (!window.confirm('Are you sure you want to delete this image?')) {
        return;
      }
      
      setIsImageDeleting(image.id);
      
      // Call the server operation to delete the image
      const result = await deleteGeneratedImageData({ id: image.id });
      
      if (result.success) {
        // Add to local deleted images list for immediate UI update
        setDeletedImageIds(prev => [...prev, image.id]);
        toast.success('Image deleted successfully');
      }
    } catch (error) {
      console.error('Failed to delete image:', error);
      toast.error('Failed to delete image');
    } finally {
      setIsImageDeleting(null);
    }
  };

  // Filter out deleted images
  const filteredImages = images.filter(image => !deletedImageIds.includes(image.id));

  return (
    <>
      <div className='flex flex-col items-center'>
        {filteredImages.map((image, index) => (
          <div key={image.url + index} className={`flex w-full items-center justify-center gap-4 p-4 hover:bg-gray-50 group ${imageId === image.id ? 'bg-yellow-50' : ''}`}>
            {/* Thumbnail */}
            <div className='relative w-64 h-32 flex-shrink-0 mr-4'>
              <img src={image.url} alt={`Generated option ${index + 1}`} className='w-full h-full object-cover rounded-lg' />
              <button
                onClick={() => setEnlargedImage(image)}
                className='absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 hover:opacity-100 transition-opacity duration-200 rounded-lg'
                title='Enlarge Image'
              >
                <FaExpand className='w-6 h-6 text-white' />
              </button>
              {!image.saved && (
                <div className={cn('absolute top-2 right-2 flex items-center bg-gray-500 bg-opacity-50 text-white text-xs px-2 py-1 rounded-full text-white')}>
                  Deletes in {getMinutesUntilDeletion(image.createdAt)} mins {getMinutesUntilDeletion(image.createdAt) <= 15 && <FaExclamationTriangle className='ml-2 text-yellow-400' />}
                </div>
              )}
            </div>

            {/* Prompt and Actions */}
            <div className='flex flex-col items-start justify-between divide-y divide-gray-200 w-full gap-2'>
              {/* Actions */}
              <div className='flex items-start gap-4'>
                <button
                  onClick={async () => {
                    try {
                      setIsImageStoring(image.id);
                      await saveGeneratedImageData({ id: image.id });
                      toast.success('Image saved successfully');
                    } catch (error) {
                      console.error('Failed to save image:', error);
                      toast.error('Failed to save image');
                    } finally {
                      setIsImageStoring(null);
                    }
                  }}
                  disabled={image.saved || isImageStoring === image.id}
                  className={cn('flex flex-col items-center gap-1', {
                    'opacity-50 cursor-not-allowed': image.saved || isImageStoring === image.id,
                  })}
                  title={'Prevent image from being deleted after 1 hour'}
                >
                  <div className='p-2 rounded-full bg-white text-gray-800 hover:bg-yellow-500 hover:text-white transition-colors duration-200'>
                    {isImageStoring === image.id ? (
                      <div className="w-4 h-4 border-2 border-gray-800 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <FaSave className='w-4 h-4' />
                    )}
                  </div>
                  <span className='text-xs text-gray-600 text-center w-16'>Store Image</span>
                </button>
                <button
                  disabled={imagePromptImageId === image.id}
                  onClick={() => {
                    navigate(
                      routes.GenerateImageRoute.build({
                        search: {
                          generateBy: 'prompt',
                          imageId: image.id,
                          ...(image.imageTemplate?.id && { imageTemplateId: image.imageTemplate.id }),
                        },
                      })
                    );
                  }}
                  className={cn('flex flex-col items-center gap-1', {
                    'opacity-50 cursor-not-allowed': imagePromptImageId === image.id,
                  })}
                  title='Edit Prompt'
                >
                  <div className='p-2 rounded-full bg-white text-gray-800 hover:bg-yellow-500 hover:text-white transition-colors duration-200'>
                    <FaEdit className='w-4 h-4' />
                  </div>
                  <span className='text-xs text-gray-600 text-center w-16'>Edit Prompt</span>
                </button>
                <button
                  onClick={() => {
                    // Create a temporary anchor element
                    const link = document.createElement('a');
                    link.href = image.url;
                    // Extract image name and type from URL
                    const imageName = image.url.split('/').pop() || 'image';
                    const imageType = imageName.split('.').pop() || 'png';
                    // Set download filename
                    link.download = `${imageName.split('.')[0]}.${imageType}`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    toast.success('Download started');
                  }}
                  className='flex flex-col items-center gap-1'
                  title='Download Image'
                >
                  <div className='p-2 rounded-full bg-white text-gray-800 hover:bg-yellow-500 hover:text-white transition-colors duration-200'>
                    <FaDownload className='w-4 h-4' />
                  </div>
                  <span className='text-xs text-gray-600 text-center w-16'>Download</span>
                </button>
                <button
                  onClick={() => {
                    try {
                      navigate(`${routes.ImageOverlayRouteWithId.build({ params: { id: image.id } })}`);
                    } catch (error) {
                      console.error('Failed to navigate to image overlay:', error);
                      toast.error('Failed to navigate to OG image creation.');
                    }
                  }}
                  className='flex flex-col items-center gap-1'
                  title='Create Open Graph / Social Media Preview Image'
                >
                  <div className='p-2 rounded-full bg-white text-gray-800 hover:bg-yellow-500 hover:text-white transition-colors duration-200'>
                    <FaHashtag className='w-4 h-4' />
                  </div>
                  <span className='text-xs text-gray-600 text-center w-16'>Create OG Image</span>
                </button>
                <button
                  onClick={() => handleShareImage(image)}
                  disabled={isImageSharing === image.id}
                  className='flex flex-col items-center gap-1'
                  title='Share this image with others'
                >
                  <div className='p-2 rounded-full bg-white text-gray-800 hover:bg-yellow-500 hover:text-white transition-colors duration-200'>
                    {isImageSharing === image.id ? (
                      <div className="w-4 h-4 border-2 border-gray-800 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <FaShare className='w-4 h-4' />
                    )}
                  </div>
                  <span className='text-xs text-gray-600 text-center w-16'>Share</span>
                </button>
                <button
                  onClick={() => handleDeleteImage(image)}
                  disabled={isImageDeleting === image.id}
                  className='flex flex-col items-center gap-1'
                  title='Delete this image'
                >
                  <div className='p-2 rounded-full bg-white text-gray-800 hover:bg-red-500 hover:text-white transition-colors duration-200'>
                    {isImageDeleting === image.id ? (
                      <div className="w-4 h-4 border-2 border-gray-800 border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <FaTrash className='w-4 h-4' />
                    )}
                  </div>
                  <span className='text-xs text-gray-600 text-center w-16'>Delete</span>
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
            <img src={enlargedImage.url} alt='Preview' className='object-contain w-full h-full shadow-2xl' />
            <button 
              onClick={() => setEnlargedImage(null)} 
              className='absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white text-gray-800 hover:bg-yellow-500 hover:text-white transition-colors duration-200'
            >
              ×
            </button>

            <div className=' p-2 bg-gray-300 text-gray-800 '>{enlargedImage.userPrompt}</div>
          </div>
        </div>
      )}
    </>
  );
};
