import type { FC } from 'react';
import Editor from '../Editor';
import { ColorPicker } from './ColorPicker';
import { ThemeSettings } from './ThemeSettings';
import BrandLogo from './BrandLogo';
import { useQuery } from 'wasp/client/operations';
import { getBrandThemeSettings } from 'wasp/client/operations';

export const Brand: FC = () => {
  const { data: brandTheme, isLoading: isBrandThemeLoading, error: brandThemeError } = useQuery(getBrandThemeSettings);

  if (brandThemeError) {
    return <div>Error: {brandThemeError.message}</div>;
  }

  return (
    <Editor>
        {isBrandThemeLoading ? (
          <div className='flex justify-center items-center min-h-[200px]'>
            <div className='animate-spin rounded-full h-8 w-8 border-2 border-yellow-500 border-t-transparent'></div>
          </div>
        ) : (
          <div className='mx-auto m-8 xl:w-4/5 2xl:w-[85%]'>
            <div className='mb-8 text-center'>
              <h1 className='text-2xl font-bold mb-2'>Brand Identity Settings</h1>
              <p className='text-gray-600 max-w-3xl mx-auto'>
                These settings help you establish a brand identity for your banners. Select a color palette that matches your brand, 
                as well as a brand logo to add to your open graph images, and preferred image moods.
              </p>
            </div>
            <div className='flex flex-col lg:flex-row gap-6 justify-center items-start'>
              <div className='w-full lg:w-1/3'>
                <BrandLogo />
              </div>
              <div className='w-full lg:w-1/3'>
                <ColorPicker />
              </div>
              <div className='w-full lg:w-1/3'>
                <ThemeSettings onSubmit={(data) => console.log('Theme settings:', data)} />
              </div>
            </div>
          </div>
        )}
    </Editor>
  );
};
