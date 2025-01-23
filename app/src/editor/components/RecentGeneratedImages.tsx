import type { FC } from 'react';
import type { GeneratedImageData } from 'wasp/entities';

import { useQuery } from 'wasp/client/operations';
import { getRecentGeneratedImageData } from 'wasp/client/operations';
import { ImageGrid } from './ImageGrid';

interface RecentGeneratedImagesProps {
  onSelectImage: (image: GeneratedImageData) => void;
  onGenerateVariations: (image: GeneratedImageData) => void;
  onSaveImage: (image: GeneratedImageData) => void;
  selectedImage: GeneratedImageData | null;
}

export const RecentGeneratedImages: FC<RecentGeneratedImagesProps> = ({
  onSelectImage,
  onGenerateVariations,
  onSaveImage,
  selectedImage
}) => {
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
      selectedImage={selectedImage}
      onSelectImage={onSelectImage}
      onGenerateVariations={onGenerateVariations}
      onSaveImage={onSaveImage}
    />
  );
};
