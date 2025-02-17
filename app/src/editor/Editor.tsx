import type { FC, ReactNode } from 'react';
import type { ImageTemplate } from 'wasp/entities';

import { FaImage, FaMagic, FaPalette, FaEdit, FaCheck } from 'react-icons/fa';
import { useState, useEffect, useMemo } from 'react';
import SidebarItem from './components/SidebarItem';
import { getImageTemplates, useQuery } from 'wasp/client/operations';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { routes, Link as WaspRouterLink } from 'wasp/client/router';
import DropdownUser from '../user/DropdownUser';
import { useAuth } from 'wasp/client/auth';
import { BiLogIn } from 'react-icons/bi';

interface EditorProps {
  children: ReactNode;
}

const Editor: FC<EditorProps> = ({ children }) => {
  const [templates, setTemplates] = useState<ImageTemplate[]>([]);
  const { data: user, isLoading: isUserLoading } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const imageTemplateId = searchParams.get('imageTemplateId');

  const isGenerateImagePath = useMemo(() => location.pathname === routes.GenerateImageRoute.to, [location.pathname]);

  const { data: imageTemplates, error: imageTemplatesError } = useQuery(getImageTemplates, undefined, { enabled: isGenerateImagePath });

  useEffect(() => {
    if (imageTemplates) {
      setTemplates(imageTemplates);
    }
    if (imageTemplatesError) {
      console.error('Error fetching image templates:', imageTemplatesError);
    }
  }, [imageTemplates]);

  const handleTemplateSelect = (templateId: ImageTemplate['id']) => {
    setSearchParams((params) => {
      params.set('imageTemplateId', templateId.toString());
      return params;
    });
  };

  return (
    <div className='flex bg-gray-100'>
      {/* Left Sidebar */}
      <div className={`min-h-screen flex flex-col relative bg-white shadow-lg transition-all duration-300`}>
        <div className='h-full overflow-y-auto m-2'>
          <SidebarItem title='Create Image' isActive={location.pathname === routes.GenerateImageRoute.to} icon={<FaMagic className='h-4 w-4 text-gray-500' />} onClick={() => navigate(routes.GenerateImageRoute.to)} />
          {/* <SidebarItem title='Create OG Image' isActive={location.pathname.includes(routes.ImageOverlayRoute.to)} icon={<FaEdit className='h-4 w-4 text-gray-500' />} onClick={() => navigate(routes.ImageOverlayRoute.to)} /> */}
          <SidebarItem
            title='Image Library'
            isActive={location.pathname.includes(routes.ImageLibraryRoute.to)}
            icon={<FaImage className='h-4 w-4 text-gray-500' />}
            onClick={() => navigate(routes.ImageLibraryRoute.to)}
          />
          <SidebarItem title='Brand Settings' isActive={location.pathname.includes(routes.BrandRoute.to)} icon={<FaPalette className='h-4 w-4 text-gray-500' />} onClick={() => navigate(routes.BrandRoute.to)} />
        </div>
      </div>

      {/* Template Images Sidebar - only shown on generate-image path */}
      {isGenerateImagePath && (
        <div className='relative bg-white shadow-lg w-80'>
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
        <div>{children}</div>
      </div>
    </div>
  );
};

export default Editor;
