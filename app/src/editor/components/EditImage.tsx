import type { FC } from 'react';
import type { GeneratedImageData, ImageTemplate } from 'wasp/entities';
import type { GeneratedImageDataWithTemplate } from './GenerateImagePrompt';

import { useEffect, useState, useRef } from 'react';
import * as fabric from 'fabric';
import Editor from '../Editor';
import { ImageGrid } from './ImageGrid';
import { useParams } from 'react-router-dom';
import { useQuery, getGeneratedImageDataById, getRecentGeneratedImageData } from 'wasp/client/operations';
import { useAuth } from 'wasp/client/auth';
import { Link } from 'wasp/client/router';


type Tool = 'select' | 'rectangle' | 'circle' | 'text' | 'draw';

export const EditImage: FC = () => {
  const { data: user } = useAuth();
  const { id } = useParams();
  const { data: imageData } = useQuery(getGeneratedImageDataById, { id: id as string }, { enabled: !!id });
  const { data: recentImages } = useQuery(getRecentGeneratedImageData, undefined, { enabled: !!user?.id });

  const [canvas, setCanvas] = useState<fabric.Canvas | null>(null);
  const [selectedTool, setSelectedTool] = useState<Tool>('select');
  const [color, setColor] = useState('#ffffff');
  const [text, setText] = useState('');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imagePromptData, setImagePromptData] = useState<GeneratedImageData | undefined>(undefined);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImageDataWithTemplate[]>([]);

  useEffect(() => {
    if (!id && recentImages?.length && recentImages.length > 0) {
      setImagePromptData(recentImages?.[0]);
    } else if (id && imageData) {
      setImagePromptData(imageData);
    }
  }, [id, recentImages, imageData]);

  useEffect(() => {
    if (!canvasRef.current || !imagePromptData) return;

    const container = canvasRef.current.parentElement;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const [imageWidth, imageHeight] = imagePromptData.resolution.split('x').map(Number);
    const scale = containerWidth / imageWidth;

    // Initialize canvas with proper dimensions and options
    const fabricCanvas = new fabric.Canvas(canvasRef.current, {
      width: containerWidth,
      height: imageHeight * scale,
      backgroundColor: 'transparent',
      preserveObjectStacking: true,
      enableRetinaScaling: true,
      renderOnAddRemove: true,
    });

    // Load background image using promise-based approach
    const loadBackgroundImage = async () => {
      try {
        const img = await fabric.FabricImage.fromURL(imagePromptData.url, {}, {
          crossOrigin: 'anonymous',
          scaleX: scale,
          scaleY: scale
        });
        
        fabricCanvas.backgroundImage = img;
        fabricCanvas.requestRenderAll();
      } catch (error) {
        console.error('Error loading background image:', error);
      }
    };

    loadBackgroundImage();

    // Modern event handling
    fabricCanvas.on('object:modified', (opt) => {
      const { target, transform } = opt;
      console.log('Object modified:', { target, transform });
    });

    setCanvas(fabricCanvas);

    return () => {
      fabricCanvas.dispose();
    };
  }, [imagePromptData]);

  useEffect(() => {
    if (!canvas) return;

    canvas.isDrawingMode = selectedTool === 'draw';
    if (canvas.isDrawingMode) {
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.width = 80;
      canvas.freeDrawingBrush.color = color;
    }
  }, [selectedTool, canvas, color]);

  const addShape = (shapeType: Tool) => {
    if (!canvas) return;
    
    setSelectedTool(shapeType);
    
    let shape;
    switch (shapeType) {
      case 'rectangle':
        shape = new fabric.Rect({
          left: 100,
          top: 100,
          width: 100,
          height: 100,
          fill: 'transparent',
          stroke: color,
          strokeWidth: 2,
          strokeUniform: true
        });
        break;
      case 'circle':
        shape = new fabric.Circle({
          left: 100,
          top: 100,
          radius: 50,
          fill: 'transparent',
          stroke: color,
          strokeWidth: 2,
          strokeUniform: true
        });
        break;
      case 'text':
        if (text) {
          shape = new fabric.Text(text, {
            left: 100,
            top: 100,
            fill: color,
            fontSize: 20,
            fontFamily: 'Arial'
          });
        }
        break;
    }

    if (shape) {
      canvas.add(shape);
      canvas.setActiveObject(shape);
      canvas.requestRenderAll();
    }
  };

  return (
    <Editor>
      {imagePromptData ? (
        <div className='mb-4'>
          <div className='flex gap-2 mb-4'>
            <button
              onClick={() => setSelectedTool('select')}
              className={`rounded px-4 py-2 text-white ${
                selectedTool === 'select' ? 'bg-yellow-600' : 'bg-yellow-500 hover:bg-yellow-600'
              }`}
            >
              Select
            </button>
            <button
              onClick={() => setSelectedTool('draw')}
              className={`rounded px-4 py-2 text-white ${
                selectedTool === 'draw' ? 'bg-yellow-600' : 'bg-yellow-500 hover:bg-yellow-600'
              }`}
            >
              Draw
            </button>
            <button
              onClick={() => addShape('rectangle')}
              className={`rounded px-4 py-2 text-white ${
                selectedTool === 'rectangle' ? 'bg-yellow-600' : 'bg-yellow-500 hover:bg-yellow-600'
              }`}
            >
              Rectangle
            </button>
            <button
              onClick={() => addShape('circle')}
              className={`rounded px-4 py-2 text-white ${
                selectedTool === 'circle' ? 'bg-yellow-600' : 'bg-yellow-500 hover:bg-yellow-600'
              }`}
            >
              Circle
            </button>
            <div className='flex items-center gap-2'>
              <button
                onClick={() => setSelectedTool('text')}
                className={`rounded px-4 py-2 text-white ${
                  selectedTool === 'text' ? 'bg-yellow-600' : 'bg-yellow-500 hover:bg-yellow-600'
                }`}
              >
                Text
              </button>
              {selectedTool === 'text' && (
                <input
                  type='text'
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      addShape('text');
                    }
                  }}
                  className='rounded-md border border-gray-300 px-3 py-1'
                  placeholder='Enter text...'
                />
              )}
            </div>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer"
            />
            {canvas && (
              <button
                onClick={() => {
                  const activeObject = canvas.getActiveObject();
                  if (activeObject) {
                    canvas.remove(activeObject);
                    canvas.renderAll();
                  }
                }}
                className='rounded px-4 py-2 text-white bg-red-500 hover:bg-red-600'
              >
                Delete Selected
              </button>
            )}
          </div>

          <div className='mb-8 overflow-hidden shadow-lg relative'>
            <canvas ref={canvasRef} className='w-full h-auto' />
          </div>
          
          <label htmlFor='image-prompt' className='block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2'>
            Edit Image Prompt
          </label>
          <textarea
            id='image-prompt'
            value={imagePromptData.userPrompt || ''}
            onChange={(e) => setImagePromptData((prev) => ({ ...prev!, prompt: e.target.value }))}
            className='w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-yellow-500 focus:outline-none focus:ring-yellow-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white min-h-[100px]'
            placeholder='Edit the prompt to regenerate the image'
          />
          <button
            onClick={async () => {
              try {
                if (!imagePromptData) return;
                // const newImages = await generateBanner({
                //   centerInfoPrompts: [imagePromptData.prompt],
                // });
                // setGeneratedImages((prev) => [...prev, ...newImages]);
              } catch (error) {
                console.error('Failed to generate edited image:', error);
              }
            }}
            // disabled={!imagePromptData?.promptTemplate?.userPrompt}
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
