import { FC } from 'react';
import { UseFormRegister } from 'react-hook-form';
import { ThemeSettingsData } from './ThemeSettings';

interface CheckboxGroupProps {
  label: string;
  name: keyof ThemeSettingsData;
  options: string[];
  description: string;
  selectedValues: string[] | undefined;
  register: UseFormRegister<ThemeSettingsData>;
}

const CheckboxGroup: FC<CheckboxGroupProps> = ({
  label,
  name,
  options,
  description,
  selectedValues = [],
  register
}) => {
  const values = Array.isArray(selectedValues) ? selectedValues : [];

  return (
    <div className="mb-4">
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        <span className="ml-1 text-xs text-gray-500">
          ({description}) - Choose up to 3
        </span>
      </label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {options.map((option) => (
          <label
            key={option}
            className={`flex items-center space-x-2 rounded-md border p-2 ${
              values.includes(option) ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
            }`}
          >
            <input
              type="checkbox"
              value={option}
              {...register(name)}
              disabled={values.length >= 3 && !values.includes(option)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default CheckboxGroup; 