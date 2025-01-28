import type { FC, ReactNode } from 'react';
import type { GeneratedImageData } from 'wasp/entities';

import * as fabric from 'fabric';
import { FaChevronLeft, FaChevronRight, FaCog, FaImage, FaFont, FaMagic, FaPalette, FaEdit } from 'react-icons/fa';
import { useState, useEffect, useRef, forwardRef } from 'react';
import { ColorPicker } from './components/ColorPicker';
import { ExampleImageUpload } from './components/ExampleImageUpload';
import { ThemeSettings } from './components/ThemeSettings';
import { GenerateImageVariations } from './components/GenerateImageVariations';
import SidebarItem from './components/SidebarItem';
import { generateBanner, generatePromptFromTitle } from 'wasp/client/operations';
import { ImageGrid } from './components/ImageGrid';
import { RecentGeneratedImages } from './components/RecentGeneratedImages';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Toolbar } from './components/Toolbar';
import { Modal } from './components/Modal';

interface EditorProps {
  children: ReactNode;
}

type SidebarItem = 'settings' | 'images' | 'text' | 'prompt' | 'brand' | 'recent-images' | 'generate-image' | 'edit-image';

const Editor: FC<EditorProps> = ({ children }) => {
  const [generatedImages, setGeneratedImages] = useState<GeneratedImageData[]>([]);

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [postTopic, setPostTopic] = useState<string>('');

  const [exampleImagePrompt, setExampleImagePrompt] = useState<string>('');

  const [imagePromptData, setImagePromptData] = useState<{ prompt: string; seed: number } | null>(null);

  const [activeSidebarItem, setActiveSidebarItem] = useState<SidebarItem | null>(null);
  const [selectedImage, setSelectedImage] = useState<GeneratedImageData | null>(null);
  const [showVariations, setShowVariations] = useState(false);

  const [showRecentImages, setShowRecentImages] = useState(false);
  const [showImageLibrary, setShowImageLibrary] = useState(false);

  const [isRecentImagesModalOpen, setIsRecentImagesModalOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  
  // Get the active section from the current path
  const activeSidebarItemFromPath = location.pathname.split('/')[1] as SidebarItem || null;

  const handleSidebarItemClick = (item: SidebarItem) => {
    if (item === 'recent-images') {
      setIsRecentImagesModalOpen(true);
    } else {
      navigate(`/${item}`);
    }
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
            <SidebarItem title='Create Base Image' isActive={activeSidebarItemFromPath === 'generate-image'} icon={<FaMagic className='h-4 w-4 text-gray-500' />} onClick={() => navigate('/generate-image')} />
            <SidebarItem title='Edit Image Prompt' isActive={activeSidebarItemFromPath === 'edit-image'} icon={<FaEdit className='h-4 w-4 text-gray-500' />} onClick={() => navigate('/edit-image')} />
            <SidebarItem title='Recent Images' isActive={activeSidebarItemFromPath === 'recent-images'} icon={<FaImage className='h-4 w-4 text-gray-500' />} onClick={() => navigate('/recent-images')} />
            <SidebarItem title='Settings' isActive={activeSidebarItemFromPath === 'settings'} icon={<FaCog className='h-4 w-4 text-gray-500' />} onClick={() => handleSidebarItemClick('settings')} />
            <SidebarItem title='Brand' isActive={activeSidebarItemFromPath === 'brand'} icon={<FaPalette className='h-4 w-4 text-gray-500' />} onClick={() => navigate('/brand')} />
            <SidebarItem title='Images' isActive={activeSidebarItemFromPath === 'images'} icon={<FaImage className='h-4 w-4 text-gray-500' />} onClick={() => handleSidebarItemClick('images')} />
            <SidebarItem title='Text' isActive={activeSidebarItemFromPath === 'text'} icon={<FaFont className='h-4 w-4 text-gray-500' />} onClick={() => handleSidebarItemClick('text')} />
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className='flex flex-1 flex-col'>
        {/* Top Toolbar */}
        <Toolbar isRecentImagesModalOpen={isRecentImagesModalOpen} setIsRecentImagesModalOpen={setIsRecentImagesModalOpen} />

        {/* Canvas Area - Now using Outlet */}
        <div className='flex-1 overflow-auto p-8'>
          <div className='mx-auto w-full max-w-4xl'>{children}</div>
        </div>
      </div>

      {/* Add Modal */}
      <Modal isOpen={isRecentImagesModalOpen} onClose={() => setIsRecentImagesModalOpen(false)} title='Recently Generated Images'>
        <RecentGeneratedImages />
      </Modal>

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
