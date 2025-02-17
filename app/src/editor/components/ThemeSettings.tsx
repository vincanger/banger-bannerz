import type { ImageTemplate } from 'wasp/entities';
import type { FC } from 'react';

import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import CheckboxGroup from './CheckboxGroup';
import { ImageMood } from '../../banner/imageSettings';
import { useQuery, useAction, getBrandThemeSettings, saveBrandThemeSettings, getImageTemplates } from 'wasp/client/operations';
import { BrandTheme } from 'wasp/entities';

interface ThemeSettingsProps {
  onSubmit?: (data: Partial<BrandTheme>) => void;
}

export const ThemeSettings: FC<ThemeSettingsProps> = ({ onSubmit }) => {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { touchedFields },
  } = useForm<Partial<BrandTheme>>();

  const { data: brandTheme, error: brandThemeError, isLoading: isBrandThemeLoading } = useQuery(getBrandThemeSettings);
  const { data: imageTemplates, error: imageTemplatesError, isLoading: isImageTemplatesLoading } = useQuery(getImageTemplates);

  const saveBrandThemeSettingsOptimistically = useAction(saveBrandThemeSettings, {
    optimisticUpdates: [
      {
        getQuerySpecifier: () => [getBrandThemeSettings],
        updateQuery: (newThemeData, oldTheme) => ({
          ...oldTheme,
          ...newThemeData,
        }),
      },
    ],
  });

  // Initialize form with brandTheme data when it loads
  useEffect(() => {
    if (brandTheme && !touchedFields) {
      setValue('imageTemplateId', brandTheme.imageTemplateId || '');
      setValue('mood', brandTheme.mood || []);
    }
  }, [brandTheme, setValue, touchedFields]);

  // Handle individual checkbox changes
  const handleCheckboxChange = (name: keyof BrandTheme, value: string, isChecked: boolean) => {
    try {
      const currentValue = watch(name);
      let currentValues = Array.isArray(currentValue) 
        ? currentValue 
        : (currentValue ? [String(currentValue)] : []);

      // For single selection (maxSelections === 1), replace the current value
      if (name === 'imageTemplateId' && isChecked) {
        currentValues = [value];
      } else if (name === 'imageTemplateId' && !isChecked) {
        currentValues = [];
      } else {
        // For multiple selections
        currentValues = isChecked 
          ? [...currentValues, value] 
          : currentValues.filter((v) => v !== value);
      }

      saveBrandThemeSettingsOptimistically({
        brandTheme: {
          id: brandTheme?.id,
          [name]: name === 'imageTemplateId' ? (currentValues[0] || null) : currentValues,
        },
      });

      // Update form value immediately
      setValue(name, name === 'imageTemplateId' ? (currentValues[0] || null) : currentValues);
    } catch (error) {
      console.error(`Failed to update ${name}:`, error);
      if (brandTheme) {
        setValue(name, brandTheme[name]);
      }
    }
  };

  return (
    <form className='p-4'>
      <h2 className='my-4 text-lg font-semibold text-gray-900'>Preferred Image Settings</h2>

      {/* <CheckboxGroup
        label='Image Style'
        name='imageTemplateId'
        options={imageTemplates?.map((template) => template.name) || []}
        description='Select your preferred image style'
        selectedValues={brandTheme?.imageTemplateId ? [brandTheme.imageTemplateId] : null}
        register={register}
        onChange={(name, value, isChecked) => handleCheckboxChange(name, value, isChecked)}
        maxSelections={1} // Limit to single selection
      /> */}

      <CheckboxGroup
        label='Image Moods'
        name='mood'
        options={Object.values(ImageMood)}
        description='Select up to 3 emotional tones'
        selectedValues={brandTheme?.mood || []}
        register={register}
        onChange={(name, value, isChecked) => handleCheckboxChange(name, value, isChecked)}
        maxSelections={3}
      />
    </form>
  );
};
