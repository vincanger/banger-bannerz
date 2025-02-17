import type { FC } from 'react';

import { useQuery } from 'wasp/client/operations';
import { getRecentGeneratedImageData } from 'wasp/client/operations';
import { ImageGrid } from './ImageGrid';
import Editor from '../Editor';

export const ImageLibraryPage: FC = () => {
  const { data: recentImages, isLoading, error } = useQuery(getRecentGeneratedImageData);

  if (isLoading) {
    return (
      <div className='flex items-center justify-center p-8'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500'></div>
      </div>
    );
  }

  if (error) {
    return <div className='p-4 text-red-500'>Error loading recent images: {error.message}</div>;
  }

  if (!recentImages?.length) {
    return (
      <Editor>
        <div className='flex items-center justify-center h-64'>
          <p className='text-gray-500'>No images found</p>
        </div>
      </Editor>
    );
  }

  return (
    <Editor>
      <div className='flex flex-col items-center justify-start'>
        <ImageGrid images={recentImages} />
      </div>
    </Editor>
  );
};
