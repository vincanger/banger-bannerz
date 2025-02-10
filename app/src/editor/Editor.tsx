import type { FC, ReactNode } from 'react';
import type { GeneratedImageData, ImageTemplate } from 'wasp/entities';

import * as fabric from 'fabric';
import { FaChevronLeft, FaChevronRight, FaCog, FaImage, FaFont, FaMagic, FaPalette, FaEdit, FaCheck, FaBan } from 'react-icons/fa';
import { useState, useEffect, useRef, forwardRef } from 'react';
import SidebarItem from './components/SidebarItem';
import { getImageTemplates, useQuery } from 'wasp/client/operations';
import { RecentGeneratedImages } from './components/RecentGeneratedImages';
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Toolbar } from './components/Toolbar';
import { Modal } from './components/Modal';

interface EditorProps {
  children: ReactNode;
}

type SidebarItem = 'settings' | 'images' | 'text' | 'prompt' | 'brand' | 'recent-images' | 'generate-image' | 'edit-image';

const Editor: FC<EditorProps> = ({ children }) => {
  const [generatedImages, setGeneratedImages] = useState<GeneratedImageData[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [isRecentImagesModalOpen, setIsRecentImagesModalOpen] = useState(false);
  const [templates, setTemplates] = useState<ImageTemplate[]>([]);
  const { data: imageTemplates, error: imageTemplatesError } = useQuery(getImageTemplates);

  useEffect(() => {
    console.log('imageTemplates', imageTemplates);
    if (imageTemplates) {
      setTemplates(imageTemplates);
    }
    if (imageTemplatesError) {
      console.error('Error fetching image templates:', imageTemplatesError);
    }
  }, [imageTemplates]);

  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const imageTemplateId = searchParams.get('imageTemplateId');

  // Get the active section from the current path
  const activeSidebarItemFromPath = (location.pathname.split('/')[1] as SidebarItem) || null;

  // Get the current path
  const currentPath = location.pathname.split('/')[1];

  const isGenerateImagePath = currentPath === 'generate-image';

  const handleTemplateSelect = (templateId: ImageTemplate['id']) => {
    setSearchParams((params) => {
      params.set('imageTemplateId', templateId.toString());
      return params;
    });
  };

  return (
    <div className='flex h-screen bg-gray-100'>
      {/* Left Sidebar */}
      <div className={`flex relative bg-white shadow-lg transition-all duration-300 ${!isSidebarOpen && 'w-0'}`}>
        <div className='h-full overflow-y-auto m-2'>
          <SidebarItem title='Create Image' isActive={activeSidebarItemFromPath === 'generate-image'} icon={<FaMagic className='h-4 w-4 text-gray-500' />} onClick={() => navigate('/generate-image')} />
          <SidebarItem title='Create OG Image' isActive={activeSidebarItemFromPath === 'edit-image'} icon={<FaEdit className='h-4 w-4 text-gray-500' />} onClick={() => navigate(`/image-overlay/`)} />
          <SidebarItem title='Recent Images' isActive={activeSidebarItemFromPath === 'recent-images'} icon={<FaImage className='h-4 w-4 text-gray-500' />} onClick={() => navigate('/recent-images')} />
          <SidebarItem title='Brand' isActive={activeSidebarItemFromPath === 'brand'} icon={<FaPalette className='h-4 w-4 text-gray-500' />} onClick={() => navigate('/brand')} />
        </div>
      </div>

      {/* Template Images Sidebar - only shown on generate-image path */}
      {isGenerateImagePath && (
        <div className='relative bg-white shadow-lg w-80'>
          <div className='absolute -right-6 top-4 z-10'>
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className='flex h-12 w-6 items-center justify-center rounded-r bg-white shadow-md'>
              {isSidebarOpen ? <FaChevronLeft className='h-5 w-5 text-gray-500' /> : <FaChevronRight className='h-5 w-5 text-gray-500' />}
            </button>
          </div>
          <div className='h-full overflow-y-auto'>
            <div className='p-4'>
              <h3 className='text-lg font-semibold mb-4'>Choose a Style</h3>
              <div className='grid grid-cols-2 gap-4'>
                {templates.map((template, index) => (
                  <button
                    key={index}
                    className='flex items-end justify-center aspect-square w-full hover:drop-shadow-xl hover:border-black/30 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-yellow-500 border border-black/10 relative overflow-hidden rounded-sm'
                    onClick={() => handleTemplateSelect(template.id)}
                  >
                    <img src={template.exampleImageUrl} alt={template.name} className='h-[115%] w-[115%] object-cover absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' />
                    {imageTemplateId === template.id && (
                      <div className='absolute top-2 right-2 bg-black rounded-full p-1'>
                        <FaCheck className='w-3 h-3 text-white' />
                      </div>
                    )}
                    <div className='relative text-xs text-black bg-white/80 backdrop-blur-sm mb-1 px-1 rounded-sm'>{template.name}</div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className='w-full'>

          <div >{children}</div>

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
