import  { useEffect, type FC } from 'react';

import { useForm } from 'react-hook-form';
import CheckboxGroup from './CheckboxGroup';
import { ImageStyle, ImageMood, ImageLighting } from '../../banner/imageSettings';
import { useQuery, useAction, getBrandTheme, saveBrandThemeSettings } from 'wasp/client/operations';
import { BrandTheme } from 'wasp/entities';


interface ThemeSettingsProps {
  onSubmit?: (data: Partial<BrandTheme>) => void;
}

export const ThemeSettings: FC<ThemeSettingsProps> = ({ onSubmit }) => {
  const { register, handleSubmit, watch, setValue, formState: { defaultValues, touchedFields } } = useForm<Partial<BrandTheme>>();
  
  const { data: brandTheme, error: brandThemeError, isLoading: isBrandThemeLoading } = useQuery(getBrandTheme);
  
  const saveBrandThemeSettingsOptimistically = useAction(saveBrandThemeSettings, {
    optimisticUpdates: [{
      getQuerySpecifier: () => [getBrandTheme],
      updateQuery: (newThemeData, oldTheme) => ({
        ...oldTheme,
        ...newThemeData
      })
    }]
  });

  useEffect(() => {
    console.log('brandTheme', brandTheme);
  }, [brandTheme]);

  // Initialize form with brandTheme data when it loads
  useEffect(() => {
    if (brandTheme && !touchedFields) {
      // Only set values if they're not already set (initial load)
      setValue('preferredStyles', brandTheme.preferredStyles || []);
      setValue('mood', brandTheme.mood || []);
      setValue('lighting', brandTheme.lighting || []);
    }
  }, [brandTheme, setValue, touchedFields]);

  // Handle individual checkbox changes
  const handleCheckboxChange = (name: keyof BrandTheme, value: string, isChecked: boolean) => {
    console.log('name', name);
    try {
      const currentValues = (watch(name) as string[]) || [];
      const newValues = isChecked 
        ? [...currentValues, value]
        : currentValues.filter((v: string) => v !== value);
      
      saveBrandThemeSettingsOptimistically({
        brandTheme: {
          id: brandTheme?.id,
          [name]: newValues
        }
      });
      
    } catch (error) {
      console.error(`Failed to update ${name}:`, error);
      // Revert the form state on error
      if (brandTheme) {
        setValue(name, brandTheme[name]);
      }
    }
  };

  return (
    <form className="p-4">
      <h2 className="my-4 text-lg font-semibold text-gray-900">Preferred Image Settings</h2>
      
      <CheckboxGroup
        label="Image Styles"
        name="preferredStyles"
        options={Object.values(ImageStyle)}
        description="Select up to 3 preferred artistic styles"
        selectedValues={brandTheme?.preferredStyles || []}
        register={register}
        onChange={(name, value, isChecked) => handleCheckboxChange(name, value, isChecked)}
      />

      <CheckboxGroup
        label="Image Moods"
        name="mood"
        options={Object.values(ImageMood)}
        description="Select up to 3 emotional tones"
        selectedValues={brandTheme?.mood || []}
        register={register}
        onChange={(name, value, isChecked) => handleCheckboxChange(name, value, isChecked)}
      />

      <CheckboxGroup
        label="Image Lighting"
        name="lighting"
        options={Object.values(ImageLighting)}
        description="Select up to 3 lighting conditions"
        selectedValues={brandTheme?.lighting || []}
        register={register}
        onChange={(name, value, isChecked) => handleCheckboxChange(name, value, isChecked)}
      />
    </form>
  );
};
