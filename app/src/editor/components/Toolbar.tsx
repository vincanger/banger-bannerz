import type { FC } from 'react';

import { routes } from 'wasp/client/router';
import { useLocation } from 'react-router-dom';
import { FaSave, FaUndo, FaRedo, FaImages, FaMagic, FaHistory } from 'react-icons/fa';

const ROUTE_TITLES: Record<string, string> = {
  [routes.GenerateImagePromptRoute.to]: 'Generate Banner',
  // Add more routes here easily
};

interface ToolbarProps {
  isRecentImagesModalOpen: boolean;
  setIsRecentImagesModalOpen: (open: boolean) => void;
}

export const Toolbar: FC<ToolbarProps> = ({ isRecentImagesModalOpen, setIsRecentImagesModalOpen }) => {
  const { pathname } = useLocation();

  return (
    <div className='bg-white p-4 shadow-md'>
      <div className='flex items-center justify-between'>
        <div className='flex space-x-4'>
          {/* Add toolbar buttons/controls */}

          <>
            <button className='flex items-center space-x-2 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600'>
              <FaImages className='h-4 w-4' />
              <span>Image Library</span>
            </button>
            <button className='flex items-center space-x-2 rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600' onClick={() => setIsRecentImagesModalOpen(true)}>
              <FaHistory className='h-4 w-4' />
              <span>Recently Generated Images</span>
            </button>
          </>
        </div>
        <div>{/* Add additional toolbar controls */}</div>
      </div>
    </div>
  );
};
