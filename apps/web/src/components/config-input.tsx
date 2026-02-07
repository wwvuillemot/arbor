'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export interface ConfigInputProps {
  label: string;
  description: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => void;
  onReset: () => void;
  isSaving?: boolean;
  isSaved?: boolean;
  isDefault?: boolean;
  className?: string;
}

export function ConfigInput({
  label,
  description,
  placeholder,
  value,
  onChange,
  onSave,
  onReset,
  isSaving = false,
  isSaved = false,
  isDefault = false,
  className,
}: ConfigInputProps) {
  const t = useTranslations('settings.configuration');
  const [localValue, setLocalValue] = React.useState(value);
  const [hasChanges, setHasChanges] = React.useState(false);

  // Store the initial value to compare against
  const initialValueRef = React.useRef(value);
  // Track if we're in the middle of user input
  const isUserInputRef = React.useRef(false);

  // Update local value when prop changes from external source (not from user input)
  React.useEffect(() => {
    // Only update if this is not a user-initiated change
    if (!isUserInputRef.current) {
      setLocalValue(value);
      initialValueRef.current = value;
      setHasChanges(false);
    }
    // Reset the flag after processing
    isUserInputRef.current = false;
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    // Mark that this is a user-initiated change
    isUserInputRef.current = true;
    setLocalValue(newValue);
    // Compare against the initial value, not the current prop value
    setHasChanges(newValue !== initialValueRef.current);
    onChange(newValue);
  };

  const handleSave = () => {
    onSave();
    // Update the initial value after saving
    initialValueRef.current = localValue;
    setHasChanges(false);
  };

  const handleReset = () => {
    if (confirm(t('resetConfirm'))) {
      onReset();
    }
  };

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-2">
        <label htmlFor={label} className="text-sm font-medium">
          {label}
        </label>
        {isDefault && (
          <span className="text-xs text-muted-foreground">
            {t('usingDefault')}
          </span>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-3">{description}</p>
      <div className="flex gap-2">
        <input
          id={label}
          type="text"
          placeholder={placeholder}
          value={localValue}
          onChange={handleChange}
          className={cn(
            'flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:cursor-not-allowed disabled:opacity-50',
            'placeholder:text-muted-foreground'
          )}
        />
        <button
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className={cn(
            'inline-flex items-center justify-center rounded-md text-sm font-medium',
            'h-9 px-4 py-2',
            'bg-primary text-primary-foreground hover:bg-primary/90',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:pointer-events-none disabled:opacity-50'
          )}
        >
          {isSaving ? t('saving') : isSaved ? t('saved') : t('save')}
        </button>
        {!isDefault && (
          <button
            onClick={handleReset}
            disabled={isSaving}
            className={cn(
              'inline-flex items-center justify-center rounded-md text-sm font-medium',
              'h-9 px-4 py-2',
              'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:pointer-events-none disabled:opacity-50'
            )}
          >
            {t('reset')}
          </button>
        )}
      </div>
    </div>
  );
}

