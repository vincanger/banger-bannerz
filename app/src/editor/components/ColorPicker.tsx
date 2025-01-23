import type { FC } from 'react';
import type { BrandTheme } from 'wasp/entities';

import { useEffect, useState, useCallback } from 'react';
import { HexColorPicker } from 'react-colorful';
import { getBrandTheme, createBrandTheme, updateBrandTheme } from 'wasp/client/operations';
import { useQuery, useAction } from 'wasp/client/operations';

import debounce from 'lodash.debounce';

interface ColorItem {
  id: string;
  value: string;
  label: string;
}

export const ColorPicker: FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [colors, setColors] = useState<string[] | undefined>(undefined);
  const [activeColorIndex, setActiveColorIndex] = useState<number>(0);

  const { data: brandTheme, isLoading: isBrandThemeLoading } = useQuery(getBrandTheme);

  useEffect(() => {
    if (isBrandThemeLoading) return;
    if (brandTheme) {
      setColors(brandTheme.colorScheme);
    } else {
      createBrandTheme({ colorScheme: ['#000000'] });
    }
    setIsInitialized(true);
  }, [brandTheme, isBrandThemeLoading]);
  
  const debouncedUpdate = useCallback(
    debounce((newColors: string[]) => {
      if (brandTheme) {
        updateBrandTheme({ id: brandTheme.id, colorScheme: newColors });
      }
    }, 300),
    [brandTheme]
  );

  useEffect(() => {
    if (!isInitialized || !colors) return;
    if (brandTheme && JSON.stringify(colors) !== JSON.stringify(brandTheme.colorScheme)) {
      debouncedUpdate(colors);
    }
  }, [colors, brandTheme, isInitialized]);

  const handleColorChange = (newColor: string) => {
    if (!colors) return;
    const newColors = colors.map((color, index) => (index === activeColorIndex ? newColor : color));
    setColors(newColors);
  };

  const addNewColor = () => {
    if (!colors) return;
    setColors([...colors, '#000000']);
    setActiveColorIndex(colors.length);
  };

  const removeColor = (index: number) => {
    if (!colors || colors.length <= 1) return;
    const newColors = colors.filter((_, i) => i !== index);
    setColors(newColors);
    setActiveColorIndex(0);
  };

  return isBrandThemeLoading ? (
    <div className='flex justify-center items-center min-h-[200px]'>
      <div className='animate-spin rounded-full h-8 w-8 border-2 border-yellow-500 border-t-transparent'></div>
    </div>
  ) : (
    <div className='p-4'>
      <h2 className='mb-4 text-lg font-semibold text-gray-900'>Color Picker</h2>
      <div className='space-y-4'>
        <label className='block text-sm font-medium text-gray-700 dark:text-gray-200'>Choose colors</label>

        <div className='flex flex-wrap gap-2 mb-4'>
          {colors &&
            colors.length > 0 &&
            colors.map((color, index) => (
              <div key={index} className='relative group'>
                <button
                  type='button'
                  onClick={() => setActiveColorIndex(index)}
                  className={`
                  h-8 w-8 rounded-md border-2 transition-all
                  ${activeColorIndex === index ? 'border-yellow-500' : 'border-gray-300'}
                `}
                  style={{ backgroundColor: color }}
                />
                {colors.length > 1 && (
                  <button type='button' onClick={() => removeColor(index)} className='absolute -top-2 -right-2 hidden group-hover:flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs'>
                    ×
                  </button>
                )}
              </div>
            ))}

          <button type='button' onClick={addNewColor} className='h-8 w-8 rounded-md border-2 border-dashed border-gray-300 hover:border-yellow-500 flex items-center justify-center'>
            +
          </button>
        </div>

        <div className='space-y-2'>
          <HexColorPicker color={colors?.[activeColorIndex]} onChange={handleColorChange} />
          <input
            type='text'
            value={colors?.[activeColorIndex]}
            onChange={(e) => handleColorChange(e.target.value)}
            className='mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-yellow-500 focus:outline-none focus:ring-yellow-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white'
          />
        </div>
      </div>
    </div>
  );
};
