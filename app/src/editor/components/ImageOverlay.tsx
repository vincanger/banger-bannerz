import { FC, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from 'wasp/client/operations';
import { getGeneratedImageDataById, getImageProxy } from 'wasp/client/operations';
import type { GeneratedImageData } from 'wasp/entities';

export const ImageOverlay: FC = () => {
  const { id } = useParams();
  const { data: imageData, isLoading: imageDataLoading, error: imageDataError } = useQuery(
    getGeneratedImageDataById,
    { id: id as string },
    { enabled: !!id }
  );

  const { data: proxiedImageUrl, isLoading: proxyLoading, error: proxyError } = useQuery(
    getImageProxy,
    { url: imageData?.url || '' },
    { enabled: !!imageData?.url }
  );

  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);

  const processImage = (imageUrl: string, text: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        try {
          // Set dimensions to standard OG image size
          const targetWidth = 1200;
          const targetHeight = 630;

          canvas.width = targetWidth;
          canvas.height = targetHeight;

          // Calculate scaling to maintain aspect ratio and center the image
          const scale = Math.max(
            targetWidth / img.width,
            targetHeight / img.height
          );
          
          const scaledWidth = img.width * scale;
          const scaledHeight = img.height * scale;
          
          // Center vertically and shift right by 1/4 of the image width
          const shiftRight = scaledWidth * 0.1; // Shift by 1/4 of the scaled width
          const x = (targetWidth - scaledWidth) / 2 + shiftRight;
          const y = (targetHeight - scaledHeight) / 2;

          // Fill background with white (in case image doesn't cover entire canvas after shift)
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, targetWidth, targetHeight);

          // Draw original image (centered vertically and shifted right)
          ctx.drawImage(img, x, y, scaledWidth, scaledHeight);

          // Add white overlay to left third
          const overlayWidth = targetWidth / 3;
          ctx.fillStyle = 'rgba(255, 255, 255, 1)';
          ctx.fillRect(0, 0, overlayWidth, targetHeight);

          // Configure text settings
          ctx.fillStyle = 'black';
          const fontSize = 54;
          ctx.font = `bold ${fontSize}px Arial`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          
          // Process text into lines
          const words = text.split(' ');
          const lines: string[] = [];
          let currentLine = '';
          const maxWidth = overlayWidth - 60;
          
          words.forEach(word => {
            const testLine = currentLine ? `${currentLine} ${word}` : word;
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth) {
              lines.push(currentLine);
              currentLine = word;
            } else {
              currentLine = testLine;
            }
          });
          lines.push(currentLine);

          // Draw each line
          const lineHeight = fontSize * 1.35;
          const totalHeight = lines.length * lineHeight;
          const startY = (targetHeight - totalHeight) / 2;
          
          lines.forEach((line, index) => {
            ctx.fillText(line, overlayWidth / 2, startY + (index * lineHeight));
          });

          // Convert to data URL with better quality
          const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
          resolve(dataUrl);
        } catch (error: any) {
          reject(new Error(`Error processing image: ${error.message}`));
        }
      };

      img.onerror = () => {
        reject(new Error('Failed to load image. Please ensure the image URL is accessible.'));
      };

      img.crossOrigin = 'anonymous';
      img.src = imageUrl;
    });
  };

  useEffect(() => {
    const processImageData = async () => {
      if (proxiedImageUrl && imageData?.prompt) {
        try {
          const processed = await processImage(proxiedImageUrl, 'Beautiful Forms with React Hook Form, Zod, and ShadCN');
          setProcessedImageUrl(processed);
        } catch (error) {
          console.error('Failed to process image:', error);
          setProcessedImageUrl(null);
        }
      }
    };

    processImageData();
  }, [proxiedImageUrl, imageData]);

  if (imageDataLoading || proxyLoading) {
    return (
      <div className='flex items-center justify-center h-64'>
        <p className='text-gray-500'>Loading image...</p>
      </div>
    );
  }

  if (imageDataError || proxyError) {
    return (
      <div className='flex items-center justify-center h-64'>
        <p className='text-red-500'>
          Error loading image: {imageDataError?.message || proxyError?.message}
        </p>
      </div>
    );
  }

  if (!imageData || !proxiedImageUrl) {
    return (
      <div className='flex items-center justify-center h-64'>
        <p className='text-gray-500'>No image found</p>
      </div>
    );
  }

  return (
    <div className='max-w-4xl mx-auto p-4'>
      <div className='space-y-4'>
        {/* Original Image */}
        <div className='rounded-lg overflow-hidden shadow-lg'>
          <img
            src={proxiedImageUrl}
            alt='Original image'
            className='w-full h-auto'
          />
          <div className='p-4 bg-gray-50 dark:bg-gray-800'>
            <p className='text-sm text-gray-600 dark:text-gray-300'>Original Image</p>
          </div>
        </div>

        {/* Processed Image */}
        {processedImageUrl && (
          <div className='rounded-lg overflow-hidden shadow-lg'>
            <img
              src={processedImageUrl}
              alt='Processed image with overlay and text'
              className='w-full h-auto'
            />
            <div className='p-4 bg-gray-50 dark:bg-gray-800'>
              <p className='text-sm text-gray-600 dark:text-gray-300'>Processed Image with Overlay</p>
              <p className='text-xs text-gray-500 dark:text-gray-400 mt-1'>{imageData.prompt}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}; 