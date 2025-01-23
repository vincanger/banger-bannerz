import type { FC, ReactNode } from 'react';
import type { GeneratedImageData } from 'wasp/entities';

import * as fabric from 'fabric';
import { FaChevronLeft, FaChevronRight, FaCog, FaImage, FaFont, FaMagic, FaPalette } from 'react-icons/fa';
import { useState, useEffect, useRef, forwardRef } from 'react';
import { ColorPicker } from './components/ColorPicker';
import { ExampleImageUpload } from './components/ExampleImageUpload';
import { ThemeSettings } from './components/ThemeSettings';
import { GenerateImageVariations } from './components/GenerateImageVariations';
import SidebarItem from './components/SidebarItem';
import { generateBanner, generatePromptFromTitle } from 'wasp/client/operations';
import { ImageGrid } from './components/ImageGrid';
import { RecentGeneratedImages } from './components/RecentGeneratedImages';

interface EditorProps {
  // Add props as needed
}

type SidebarItem = 'settings' | 'images' | 'text' | 'prompt' | 'theme' | 'recent';

const Editor: FC<EditorProps> = () => {
  const [generatedImages, setGeneratedImages] = useState<GeneratedImageData[]>([]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [postTopic, setPostTopic] = useState<string>('');

  const [exampleImagePrompt, setExampleImagePrompt] = useState<string>('');

  const [imagePromptData, setImagePromptData] = useState<{ prompt: string; seed: number } | null>(null);

  const [activeSidebarItem, setActiveSidebarItem] = useState<SidebarItem | null>(null);
  const [selectedImage, setSelectedImage] = useState<GeneratedImageData | null>(null);
  const [showVariations, setShowVariations] = useState(false);
  const [recentImages, setRecentImages] = useState<GeneratedImageData[]>([]);

  const handleSidebarItemClick = (item: SidebarItem) => {
    setActiveSidebarItem(item === activeSidebarItem ? null : item);
  };

  const handleImageSelect = (image: GeneratedImageData) => {
    setShowVariations(false);
    setSelectedImage(image);
    setImagePromptData({ prompt: image.prompt, seed: image.seed });
    setActiveSidebarItem('prompt');
  };

  const handleGenerateVariations = (image: GeneratedImageData) => {
    setSelectedImage(image);

    setImagePromptData({ prompt: image.prompt, seed: image.seed });
    setShowVariations(true);
    // setActiveSidebarItem('prompt');
    // You can set the initial prompt here if you have access to the prompt that generated this image
  };

  const handleSaveImage = (image: GeneratedImageData) => {
    // TODO: save image to database
    console.log('save image', image);
  };

  useEffect(() => {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recent = generatedImages.filter(img => {
      const imageDate = new Date(img.createdAt);
      return imageDate > last24Hours;
    });
    setRecentImages(recent);
  }, [generatedImages]);

  return (
    <div className='flex h-screen bg-gray-100'>
      {/* Left Sidebar */}
      <div className={`relative bg-white shadow-lg transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-0'}`}>
        <div className='absolute -right-6 top-4 z-10'>
          <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className='flex h-12 w-6 items-center justify-center rounded-r bg-white shadow-md'>
            {isSidebarOpen ? <FaChevronLeft className='h-5 w-5 text-gray-500' /> : <FaChevronRight className='h-5 w-5 text-gray-500' />}
          </button>
        </div>

        {isSidebarOpen && (
          <div className='h-full overflow-y-auto mt-2'>
            <SidebarItem title='Prompt Info' isActive={activeSidebarItem === 'prompt'} icon={<FaMagic className='h-4 w-4 text-gray-500' />} onClick={() => handleSidebarItemClick('prompt')} />
            <SidebarItem title='Settings' isActive={activeSidebarItem === 'settings'} icon={<FaCog className='h-4 w-4 text-gray-500' />} onClick={() => handleSidebarItemClick('settings')} />
            <SidebarItem title='Theme' isActive={activeSidebarItem === 'theme'} icon={<FaPalette className='h-4 w-4 text-gray-500' />} onClick={() => handleSidebarItemClick('theme')} />
            <SidebarItem title='Images' isActive={activeSidebarItem === 'images'} icon={<FaImage className='h-4 w-4 text-gray-500' />} onClick={() => handleSidebarItemClick('images')} />
            <SidebarItem title='Text' isActive={activeSidebarItem === 'text'} icon={<FaFont className='h-4 w-4 text-gray-500' />} onClick={() => handleSidebarItemClick('text')} />
            <SidebarItem title='Recent Images' isActive={activeSidebarItem === 'recent'} icon={<FaImage className='h-4 w-4 text-gray-500' />} onClick={() => handleSidebarItemClick('recent')} />
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className='flex flex-1 flex-col'>
        {/* Top Toolbar */}
        <div className='bg-white p-4 shadow-md'>
          <div className='flex items-center justify-between'>
            <div className='flex space-x-4'>
              {/* Add toolbar buttons/controls */}
              <button className='rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600'>Save</button>
              <button className='rounded bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300'>Undo</button>
              <button className='rounded bg-gray-200 px-4 py-2 text-gray-700 hover:bg-gray-300'>Redo</button>
            </div>
            <div>{/* Add additional toolbar controls */}</div>
          </div>
        </div>

        {/* Canvas Area */}
        <div className='flex-1 overflow-auto p-8'>
          <div className='mx-auto w-full max-w-4xl'>
            
            {/* Show selected image at the top if one is selected */}
            {selectedImage && (
              <div className='mb-8 rounded-lg overflow-hidden shadow-lg'>
                <img src={selectedImage.url} alt='Selected image' className='w-full h-auto' />
              </div>
            )}

            {/* Canvas content based on active item */}
            {activeSidebarItem === 'settings' && <div>Settings Content</div>}
            {activeSidebarItem === 'theme' && (
              <SidebarWrapper>
                <ColorPicker />
                <ThemeSettings onSubmit={(data) => console.log('Theme settings:', data)} />
              </SidebarWrapper>
            )}
            {activeSidebarItem === 'images' && <p>ok</p>}
            {activeSidebarItem === 'text' && <div>Text Content</div>}
            {activeSidebarItem === 'prompt' && (
              <SidebarWrapper>
                {!showVariations ? (
                  <>
                    {selectedImage ? (
                      <div className='mb-4'>
                        <label htmlFor='image-prompt' className='block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2'>
                          Edit Image Prompt
                        </label>
                        <textarea
                          id='image-prompt'
                          value={imagePromptData?.prompt || ''}
                          onChange={(e) => setImagePromptData(prev => ({ ...prev!, prompt: e.target.value }))}
                          className='w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-yellow-500 focus:outline-none focus:ring-yellow-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white min-h-[100px]'
                          placeholder='Edit the prompt to regenerate the image'
                        />
                        <button
                          onClick={async () => {
                            try {
                              if (!imagePromptData) return;
                              const newImage = await generateBanner({ 
                                prompt: imagePromptData.prompt,
                                seed: imagePromptData.seed
                              });
                              setGeneratedImages(prev => [newImage, ...prev]);
                              setSelectedImage(newImage);
                            } catch (error) {
                              console.error('Failed to generate edited image:', error);
                            }
                          }}
                          disabled={!imagePromptData?.prompt}
                          className='mt-2 w-full rounded bg-yellow-500 px-4 py-2 text-white hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed'
                        >
                          Generate Edit
                        </button>
                      </div>
                    ) : (
                      <div className='mb-4'>
                        <label htmlFor='prompt-title' className='block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2'>
                          Title or Topic of Post
                        </label>
                        <input
                          type='text'
                          id='prompt-title'
                          value={postTopic}
                          onChange={(e) => setPostTopic(e.target.value)}
                          className='w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-yellow-500 focus:outline-none focus:ring-yellow-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white'
                          placeholder='Enter the title or topic of your post'
                        />
                      </div>
                    )}
                    <button
                      onClick={async () => {
                        try {
                          const generatedPrompts = await generatePromptFromTitle({ title: postTopic });

                          if (generatedPrompts.prompts.length > 0) {
                            const generatedBanners = generatedPrompts.prompts.map((prompt) => generateBanner({ prompt: prompt }));

                            const imageResults = await Promise.all(generatedBanners);
                            setGeneratedImages(imageResults);
                          }
                        } catch (error) {
                          console.error('Failed to generate prompt from title:', error);
                        }
                      }}
                      disabled={!postTopic}
                      className='w-full rounded bg-yellow-500 px-4 py-2 text-white hover:bg-yellow-600 disabled:bg-gray-300 disabled:cursor-not-allowed'
                    >
                      Generate Prompt from Title
                    </button>

                    <details className='mb-4'>
                      <summary className='cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-200'>Use an example image as a guide?</summary>
                      <div className='mt-2'>
                        <ExampleImageUpload setExampleImagePrompt={setExampleImagePrompt} />
                      </div>
                    </details>
                    {generatedImages.length > 0 && <ImageGrid images={generatedImages} selectedImage={selectedImage} onSelectImage={handleImageSelect} onGenerateVariations={handleGenerateVariations} onSaveImage={handleSaveImage} />}
                  </>
                ) : (
                  selectedImage && <GenerateImageVariations prompt={selectedImage.prompt} />
                )}
              </SidebarWrapper>
            )}
            {activeSidebarItem === 'recent' && (
              <SidebarWrapper>
                <RecentGeneratedImages onSelectImage={handleImageSelect} onGenerateVariations={handleGenerateVariations} onSaveImage={handleSaveImage} selectedImage={selectedImage} />
              </SidebarWrapper>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Editor;

const SidebarWrapper = ({ children }: { children: ReactNode }) => {
  return <div className='p-4'>{children}</div>;
};

const DEV_MODE = process.env.NODE_ENV === 'development';

declare global {
  var canvas: fabric.Canvas | undefined;
}

export const Canvas = forwardRef<fabric.Canvas, { onLoad?(canvas: fabric.Canvas): void }>(({ onLoad }, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }

    const canvas = new fabric.Canvas(canvasRef.current);

    DEV_MODE && (window.canvas = canvas);

    if (typeof ref === 'function') {
      ref(canvas);
    } else if (typeof ref === 'object' && ref) {
      ref.current = canvas;
    }

    // it is crucial `onLoad` is a dependency of this effect
    // to ensure the canvas is disposed and re-created if it changes
    onLoad?.(canvas);

    return () => {
      DEV_MODE && delete window.canvas;

      if (typeof ref === 'function') {
        ref(null);
      } else if (typeof ref === 'object' && ref) {
        ref.current = null;
      }

      // `dispose` is async
      // however it runs a sync DOM cleanup
      // its async part ensures rendering has completed
      // and should not affect react
      canvas.dispose();
    };
  }, [canvasRef, onLoad]);

  return <canvas ref={canvasRef} />;
});
