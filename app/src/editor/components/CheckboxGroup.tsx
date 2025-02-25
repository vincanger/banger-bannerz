import type { FC } from 'react';
import type { BrandTheme } from 'wasp/entities';

import  { UseFormRegister } from 'react-hook-form';
import { cn } from '../../client/cn';
import React from 'react';

interface CheckboxGroupProps {
  label: string;
  name: keyof BrandTheme;
  options: string[];
  description: string;
  maxSelections: number;
  selectedValues: string[] | null;
  register: UseFormRegister<Partial<BrandTheme>>;
  onChange: (name: keyof BrandTheme, value: string, isChecked: boolean) => void;
}

const CheckboxGroup: FC<CheckboxGroupProps> = ({
  label,
  name,
  options,
  description,
  selectedValues = [],
  register,
  onChange,
  maxSelections,
}) => {
  const [selectionOrder, setSelectionOrder] = React.useState<string[]>(selectedValues || []);

  React.useEffect(() => {
    setSelectionOrder(selectedValues || []);
  }, [selectedValues]);

  const handleChange = (value: string, isChecked: boolean) => {
    let newSelectionOrder: string[];

    if (isChecked) {
      if (maxSelections === 1) {
        // For single selection, replace the current selection
        newSelectionOrder = [value];
      } else {
        // Add new selection when under limit
        newSelectionOrder = [...selectionOrder, value];
      }
    } else {
      // Remove unchecked value
      newSelectionOrder = selectionOrder.filter(v => v !== value);
    }

    setSelectionOrder(newSelectionOrder);
    onChange(name, value, isChecked);
  };

  const isMaxSelectionsReached = selectionOrder.length >= maxSelections;

  return (
    <div className="mb-4">
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        <span className="ml-1 text-xs text-gray-500">
          ({description})
        </span>
      </label>
      <div className="mt-2 grid grid-cols-2 gap-2">
        {options.map((option) => {
          const isSelected = selectionOrder.includes(option);
          const isDisabled = !isSelected && isMaxSelectionsReached && maxSelections > 1;

          return (
            <label
              key={option}
              className={cn(
                'flex items-center space-x-2 rounded-md border p-2',
                isSelected && 'border-blue-500 bg-blue-50',
                !isSelected && 'border-gray-300',
                isDisabled && 'cursor-not-allowed opacity-50'
              )}
            >
              <input
                type="checkbox"
                value={option}
                {...register(name)}
                checked={isSelected}
                disabled={isDisabled}
                onChange={(e) => handleChange(e.target.value, e.target.checked)}
                className={cn(
                  'h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500',
                  isDisabled && 'cursor-not-allowed'
                )}
              />
              <span className={cn(
                'text-sm text-gray-700',
                isDisabled && 'text-gray-400'
              )}>
                {option.charAt(0).toUpperCase() + option.slice(1)}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
};
export default CheckboxGroup; 