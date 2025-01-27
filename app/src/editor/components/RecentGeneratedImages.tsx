import type { FC } from 'react';

import { useQuery } from 'wasp/client/operations';
import { getRecentGeneratedImageData } from 'wasp/client/operations';
import { ImageGrid } from './ImageGrid';

export const RecentGeneratedImages: FC = () => {
  const { data: recentImages, isLoading, error } = useQuery(getRecentGeneratedImageData);

  if (isLoading) {
    return (
      <div className='flex items-center justify-center p-8'>
        <div className='animate-spin rounded-full h-8 w-8 border-b-2 border-yellow-500'></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className='p-4 text-red-500'>
        Error loading recent images: {error.message}
      </div>
    );
  }

  if (!recentImages?.length) {
    return (
      <div className='p-4 text-gray-500 dark:text-gray-400'>
        No recent images found
      </div>
    );
  }

  return (
    <ImageGrid
      images={recentImages}
    />
  );
};
