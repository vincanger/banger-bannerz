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
        <div className='flex flex-col gap-2 justify-center items-start mx-auto m-8 xl:w-1/2 2xl:w-[65%]'>
          <BrandLogo />
          <ColorPicker />
          <ThemeSettings onSubmit={(data) => console.log('Theme settings:', data)} />
        </div>
      )}

    </Editor>
  );
};
