import type { FC } from 'react';

import { useEffect, useState, useCallback } from 'react';
import { HexColorPicker } from 'react-colorful';
import { getBrandThemeSettings, saveBrandThemeSettings } from 'wasp/client/operations';
import { useQuery } from 'wasp/client/operations';
import debounce from 'lodash.debounce';

export const ColorPicker: FC = () => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [colors, setColors] = useState<string[]>([]);
  const [activeColorIndex, setActiveColorIndex] = useState<number | undefined>(undefined);
  const [inputValue, setInputValue] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);

  const { data: brandTheme, isLoading: isBrandThemeLoading } = useQuery(getBrandThemeSettings);

  useEffect(() => {
    if (isBrandThemeLoading) return;
    if (brandTheme) {
      setColors(brandTheme.colorScheme.length > 0 ? brandTheme.colorScheme : []);
    }
    setIsInitialized(true);
  }, [brandTheme, isBrandThemeLoading]);

  useEffect(() => {
    if (isEditing) return;
    
    if (activeColorIndex !== undefined && colors[activeColorIndex]) {
      setInputValue(colors[activeColorIndex]);
    }
  }, [activeColorIndex, colors, isEditing]);

  const debouncedUpdate = useCallback(
    debounce((newColors: string[]) => {
      saveBrandThemeSettings({ brandTheme: { id: brandTheme?.id, colorScheme: newColors } });
    }, 300),
    [brandTheme]
  );

  useEffect(() => {
    if (!isInitialized) return;
    if (JSON.stringify(colors) !== JSON.stringify(brandTheme?.colorScheme)) {
      debouncedUpdate(colors);
    }
  }, [colors, brandTheme, isInitialized, debouncedUpdate]);

  const handleColorChange = (newColor: string) => {
    if (!colors || colors.length === 0) {
      setColors([newColor]);
      setActiveColorIndex(0);
    } else {
      const newColors = colors.map((color, index) => (index === activeColorIndex ? newColor : color));
      setColors(newColors);
    }
  };

  const addNewColor = () => {
    const newColors = colors ? [...colors, '#000000'] : ['#000000'];
    setColors(newColors);
    setActiveColorIndex(newColors.length - 1);
  };

  const removeColor = (index: number) => {
    if (!colors) return;
    const newColors = colors.filter((_, i) => i !== index);
    setColors(newColors);
    setActiveColorIndex(newColors.length > 0 ? newColors.length - 1 : undefined);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value;
    
    if (!value.startsWith('#')) {
      value = '#' + value;
    }
    
    if (value === '') {
      value = '#';
    }
    
    setInputValue(value);
    
    const isValidHex = /^#([0-9A-F]{3}){1,2}$/i.test(value);
    if (isValidHex) {
      handleColorChange(value);
    }
  };

  return (
    <div className='p-4'>
      <h2 className='mb-4 text-xl font-semibold text-gray-900'>Brand Color Scheme</h2>
      <div className='space-y-4'>

        <div className='flex flex-wrap gap-2 mb-4'>
          {colors?.map((color, index) => (
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
              {colors.length >= 1 && (
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

        {activeColorIndex !== undefined && (
          <div className='space-y-2'>
            <HexColorPicker 
              color={colors[activeColorIndex]} 
              onChange={handleColorChange} 
            />
            <input
              type='text'
              value={inputValue}
              onChange={handleInputChange}
              onFocus={(e) => {
                setIsEditing(true);
                const val = e.target.value;
                e.target.setSelectionRange(val.length, val.length);
              }}
              onBlur={(e) => {
                setIsEditing(false);
                let color = e.target.value;
                if (color === '#') {
                  color = '#000000';
                } else if (color.length < 7 && color.length > 1) {
                  color = color.padEnd(7, '0');
                }
                
                handleColorChange(color);
                setInputValue(color);
              }}
              className='mt-1 block w-[200px] rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-yellow-500 focus:outline-none focus:ring-yellow-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white'
            />
          </div>
        )}
      </div>
    </div>
  );
};
