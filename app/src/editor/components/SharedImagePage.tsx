import type { FC } from 'react';
import type { GeneratedImageData, ImageTemplate, SharedImage } from 'wasp/entities';
import type { SharedImageWithGeneratedImageData } from '../../banner/operations';

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, saveSharedImageToLibrary, getImageTemplateById, getSharedImageByToken } from 'wasp/client/operations';
import { useAuth } from 'wasp/client/auth';
import { routes } from 'wasp/client/router';
import { FaDownload, FaEdit, FaSave, FaSignInAlt, FaSpinner } from 'react-icons/fa';
import { toast } from 'react-hot-toast';
import { cn } from '../../client/cn';

export const SharedImagePage: FC = () => {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { data: user } = useAuth();

  const [isSaving, setIsSaving] = useState(false);

  const {
    data,
    isLoading,
    error: queryError,
  } = useQuery(
    getSharedImageByToken,
    { token: token || '' },
    {
      enabled: !!token,
      onSuccess: (data: { sharedImage: SharedImageWithGeneratedImageData }) => {
        if (data?.sharedImage) {
          console.log('sharedImage: ', data.sharedImage);
          // Store the image details in localStorage for later use after login
          localStorage.setItem('sharedImageToken', token!);
          if (data.sharedImage.generatedImageData.postTopic) {
            localStorage.setItem('postTopic', data.sharedImage.generatedImageData.postTopic);
          }
          localStorage.setItem('userPrompt', data.sharedImage.generatedImageData.userPrompt);
        }
      },
      onError: (err: any) => {
        console.error('Error fetching shared image:', err);
      },
    }
  );

  const sharedImage = data?.sharedImage;
  const error = queryError ? 'Failed to load the shared image' : !sharedImage ? 'This shared image link is invalid or has expired' : null;

  const handleSaveToLibrary = async () => {
    if (!user) {
      // Redirect to login page
      navigate(routes.LoginRoute.to);
      return;
    }

    if (!token) return;

    try {
      setIsSaving(true);

      // Check if the image was already saved automatically after login
      const savedToken = localStorage.getItem('sharedImageToken');

      // If the token is still in localStorage, it means it hasn't been saved yet
      if (savedToken === token) {
        const result = await saveSharedImageToLibrary({ token });

        if (result.success) {
          // Clear the token from localStorage to prevent duplicate saves
          localStorage.removeItem('sharedImageToken');
          toast.success('Image saved to your library!');
          // Navigate to the image in the user's library
          navigate(routes.ImageLibraryRoute.to);
        }
      } else {
        // Image was already saved automatically
        toast.success('Image already saved to your library!');
        navigate(routes.ImageLibraryRoute.to);
      }
    } catch (err) {
      console.error('Error saving image to library:', err);
      toast.error('Failed to save the image to your library');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateWithPrompt = () => {
    if (!sharedImage) return;

    // Clear the shared image token from localStorage to prevent automatic saving
    localStorage.removeItem('sharedImageToken');
    
    const imageTemplateId = sharedImage.generatedImageData.imageTemplateId;

    navigate(
      routes.GenerateImageRoute.build({
        search: {
          generateBy: 'topic',
          ...(sharedImage.generatedImageData.postTopic && { postTopic: sharedImage.generatedImageData.postTopic }),
          ...(imageTemplateId && { imageTemplateId }),
        },
      })
    );
  };

  if (isLoading) {
    return (
      <div className='flex flex-col items-center justify-center min-h-screen p-4'>
        <FaSpinner className='w-8 h-8 animate-spin text-yellow-500 mb-4' />
        <p className='text-gray-600'>Loading shared image...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className='flex flex-col items-center justify-center min-h-screen p-4'>
        <div className='bg-red-50 border border-red-200 rounded-lg p-6 max-w-md'>
          <h2 className='text-xl font-semibold text-red-700 mb-2'>Error</h2>
          <p className='text-gray-700 mb-4'>{error}</p>
          <button onClick={() => navigate(routes.GenerateImageRoute.to)} className='px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors'>
            Generate Your Own Image
          </button>
        </div>
      </div>
    );
  }

  if (!sharedImage) return null;

  return (
    <div className='flex flex-col items-center min-h-screen p-4 max-w-5xl mx-auto'>
      <div className='w-full bg-white rounded-lg shadow-md p-6 mb-8'>
        <h1 className='text-2xl font-bold text-gray-800 mb-2'>Shared Banner Image</h1>
        <p className='text-gray-600 mb-6'>This banner image was shared with you. You can save it to your library or generate your own.</p>

        {/* Image Display */}
        <div className='mb-6'>
          <div className='relative rounded-lg overflow-hidden shadow-lg'>
            <img src={sharedImage.generatedImageData.url} alt='Shared banner' className='w-full h-auto object-cover' />
          </div>

          {sharedImage.generatedImageData.postTopic && (
            <div className='mt-4 p-4 bg-gray-50 rounded-md'>
              <h3 className='font-medium text-gray-700 mb-1'>Topic:</h3>
              <p className='text-gray-600'>{sharedImage.generatedImageData.postTopic}</p>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className='flex flex-wrap gap-4 justify-center'>
          {user ? (
            <>
              <button
                onClick={handleSaveToLibrary}
                disabled={isSaving}
                className={cn('flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors', { 'opacity-50 cursor-not-allowed': isSaving })}
              >
                {isSaving ? <FaSpinner className='w-4 h-4 animate-spin' /> : <FaSave className='w-4 h-4' />}
                Save to My Library
              </button>

              <button onClick={handleGenerateWithPrompt} className='flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors'>
                <FaEdit className='w-4 h-4' />
                Generate Similar Image
              </button>
            </>
          ) : (
            <>
              <button onClick={() => navigate(routes.LoginRoute.to)} className='flex items-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors'>
                <FaSignInAlt className='w-4 h-4' />
                Log in to Save This Image
              </button>

              <button onClick={handleGenerateWithPrompt} className='flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors'>
                <FaEdit className='w-4 h-4' />
                Generate Similar Image
              </button>
            </>
          )}

          <button
            onClick={() => {
              // Create a temporary anchor element
              const link = document.createElement('a');
              link.href = sharedImage.generatedImageData.url;
              // Extract image name and type from URL
              const imageName = sharedImage.generatedImageData.url.split('/').pop() || 'image';
              const imageType = imageName.split('.').pop() || 'png';
              // Set download filename
              link.download = `${imageName.split('.')[0]}.${imageType}`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              toast.success('Download started');
            }}
            className='flex items-center gap-2 px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors'
          >
            <FaDownload className='w-4 h-4' />
            Download Image
          </button>
        </div>
      </div>

      {/* Generate Your Own Section */}
      <div className='w-full bg-white rounded-lg shadow-md p-6'>
        <h2 className='text-xl font-semibold text-gray-800 mb-4'>Generate Your Own Banner Images</h2>
        <p className='text-gray-600 mb-4'>Create beautiful, customized banner images for your blog posts, social media, or any other content.</p>
        <button onClick={() => navigate(routes.GenerateImageRoute.to)} className='px-4 py-2 bg-yellow-500 text-white rounded-md hover:bg-yellow-600 transition-colors'>
          Try It Now
        </button>
      </div>
    </div>
  );
};
