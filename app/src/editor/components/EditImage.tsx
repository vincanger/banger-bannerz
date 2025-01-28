import type { FC } from 'react';

import { useEffect, useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { generatePrompts, generateBanner, removeObjectFromImage } from 'wasp/client/operations';
import Editor from '../Editor';
import { ImageGrid } from './ImageGrid';
import { useParams } from 'react-router-dom';
import { GeneratedImageData } from 'wasp/entities';
import { useQuery, getGeneratedImageDataById, getRecentGeneratedImageData } from 'wasp/client/operations';
import { useAuth } from 'wasp/client/auth';
import { Link } from 'wasp/client/router';

export const EditImage: FC = () => {
  const { data: user } = useAuth();
  const { id } = useParams();
  const { data: imageData } = useQuery(getGeneratedImageDataById, { id: id as string }, { enabled: !!id });
  const { data: recentImages } = useQuery(getRecentGeneratedImageData, undefined, { enabled: !!user?.id });

  const [imagePromptData, setImagePromptData] = useState<GeneratedImageData | undefined>(undefined);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImageData[]>([]);
  const [isDrawingMode, setIsDrawingMode] = useState(false);
  const [maskData, setMaskData] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const lastPosRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!id && recentImages?.length && recentImages.length > 0) {
      setImagePromptData(recentImages?.[0]);
    } else if (id && imageData) {
      setImagePromptData(imageData);
    }
  }, [id, recentImages, imageData]);

  const getScaledCoordinates = (canvas: HTMLCanvasElement, clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    isDrawingRef.current = true;
    lastPosRef.current = getScaledCoordinates(canvas, e.clientX, e.clientY);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !isDrawingRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const currentPos = getScaledCoordinates(canvas, e.clientX, e.clientY);

    ctx.beginPath();
    ctx.lineWidth = 80;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'white';
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
    ctx.lineTo(currentPos.x, currentPos.y);
    ctx.stroke();

    lastPosRef.current = currentPos;
  };

  const stopDrawing = () => {
    if (!canvasRef.current) return;
    isDrawingRef.current = false;
    
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvasRef.current.width;
    tempCanvas.height = canvasRef.current.height;
    const tempCtx = tempCanvas.getContext('2d');
    
    if (tempCtx) {
      tempCtx.fillStyle = 'black';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      
      tempCtx.drawImage(canvasRef.current, 0, 0);
    }
    
    setMaskData(tempCanvas.toDataURL());
  };

  const clearMask = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setMaskData(null);
  };

  return (
    <Editor>
      {imagePromptData ? (
        <div className='mb-4'>
          <div className='mb-8 overflow-hidden shadow-lg relative'>
            <img 
              src={imagePromptData?.url} 
              alt='Selected image' 
              className='w-full h-auto'
            />
            {isDrawingMode && (
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className='absolute top-0 left-0 w-full h-full cursor-crosshair'
                width={imagePromptData?.resolution.split('x')[0]}
                height={imagePromptData?.resolution.split('x')[1]}
                style={{ 
                  width: '100%',
                  height: '100%'
                }}
              />
            )}
          </div>
          
          <div className='flex gap-2 mb-4'>
            <button
              onClick={() => {
                setIsDrawingMode(!isDrawingMode);
                if (!isDrawingMode) {
                  const canvas = canvasRef.current;
                  if (!canvas) return;
                  
                  const img = new Image();
                  img.src = imagePromptData.url;
                  img.onload = () => {
                    if (!canvas) return;
                    
                    console.log('Original image dimensions:', img.naturalWidth, 'x', img.naturalHeight);
                    
                    canvas.width = img.naturalWidth;
                    canvas.height = img.naturalHeight;
                    
                    console.log('Canvas dimensions:', canvas.width, 'x', canvas.height);
                    
                    const ctx = canvas.getContext('2d');
                    if (ctx) {
                      ctx.clearRect(0, 0, canvas.width, canvas.height);
                    }
                  };
                }
              }}
              className='rounded bg-yellow-500 px-4 py-2 text-white hover:bg-yellow-600'
            >
              {isDrawingMode ? 'Exit Mask Mode' : 'Create Mask'}
            </button>
            {isDrawingMode && (
              <button
                onClick={clearMask}
                className='rounded bg-red-500 px-4 py-2 text-white hover:bg-red-600'
              >
                Clear Mask
              </button>
            )}
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
                const newImages = await generateBanner({
                  centerInfoPrompts: [imagePromptData.prompt],
                });
                setGeneratedImages((prev) => [...prev, ...newImages]);
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
          {maskData && (
            <button
              onClick={async () => {
                try {
                  if (!imagePromptData) return;
                  const result = await removeObjectFromImage({
                    imageUrl: imagePromptData.url,
                    maskUrl: maskData
                  });
                  console.log('Remove object result:', result);
                } catch (error) {
                  console.error('Failed to remove object:', error);
                }
              }}
              className='mt-2 w-full rounded bg-yellow-500 px-4 py-2 text-white hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed'
            >
              Remove Object
            </button>
          )}
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
