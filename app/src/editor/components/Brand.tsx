import type { FC } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from 'wasp/client/operations';
import { getBrandTheme } from 'wasp/client/operations';
import Editor from '../Editor';
import { ColorPicker } from './ColorPicker';
import { ThemeSettings } from './ThemeSettings';

export const Brand: FC = () => {


  return (
    <Editor>

        <ColorPicker />
        <ThemeSettings onSubmit={(data) => console.log('Theme settings:', data)} />

    </Editor>
  );
};
