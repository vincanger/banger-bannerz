import { FC, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import CheckboxGroup from './CheckboxGroup';
import { useQuery, upsertBrandTheme, getBrandTheme } from 'wasp/client/operations';

export interface ThemeSettingsData {
  preferredStyles?: string[];
  mood?: string[];
  lighting?: string[];
}

interface ThemeSettingsProps {
  onSubmit?: (data: ThemeSettingsData) => void;
}

export const ThemeSettings: FC<ThemeSettingsProps> = ({ onSubmit }) => {
  const { register, handleSubmit, watch, setValue } = useForm<ThemeSettingsData>();
  const selectedStyles = watch('preferredStyles', []);
  const selectedMoods = watch('mood', []);
  const selectedLighting = watch('lighting', []);

  const { data: brandTheme, error: brandThemeError, isLoading: isBrandThemeLoading } = useQuery(getBrandTheme);

  useEffect(() => {
    if (brandTheme) {
      setValue('preferredStyles', brandTheme.preferredStyles);
      setValue('mood', brandTheme.mood);
      setValue('lighting', brandTheme.lighting);
    }
  }, [brandTheme]);

  const handleFormSubmit = async (data: ThemeSettingsData) => {
    try {
      await upsertBrandTheme({
        preferredStyles: data.preferredStyles,
        mood: data.mood,
        lighting: data.lighting,
      });
      onSubmit?.(data);
    } catch (error) {
      console.error('Failed to save theme settings:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="p-4">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Theme Settings</h2>
      
      <CheckboxGroup
        label="Preferred Styles"
        name="preferredStyles"
        options={['photorealistic', 'digital art', 'oil painting', 'watercolor', 'illustration', 'pencil sketch', '3D render', 'pop art', 'minimalist']}
        description="Select up to 3 preferred artistic styles"
        selectedValues={selectedStyles}
        register={register}
      />

      <CheckboxGroup
        label="Mood"
        name="mood"
        options={['dramatic', 'peaceful', 'energetic', 'mysterious', 'whimsical', 'dark', 'bright', 'neutral']}
        description="Select up to 3 emotional tones"
        selectedValues={selectedMoods}
        register={register}
      />

      <CheckboxGroup
        label="Lighting"
        name="lighting"
        options={['natural', 'studio', 'dramatic', 'soft', 'neon', 'dark', 'bright', 'cinematic']}
        description="Select up to 3 lighting conditions"
        selectedValues={selectedLighting}
        register={register}
      />

      <button
        type="submit"
        className="mt-4 w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
      >
        Apply Theme Settings
      </button>
    </form>
  );
};
