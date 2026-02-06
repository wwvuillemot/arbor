'use client';

import * as React from 'react';
import { Eye, EyeOff, Check, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils';

export interface ApiKeyInputProps {
  label: string;
  description?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  onSave: () => Promise<void>;
  isSaving?: boolean;
  isSaved?: boolean;
  className?: string;
}

export function ApiKeyInput({
  label,
  description,
  placeholder,
  value,
  onChange,
  onSave,
  isSaving = false,
  isSaved = false,
  className,
}: ApiKeyInputProps) {
  const t = useTranslations('settings.apiKeys');
  const [showKey, setShowKey] = React.useState(false);
  const [localValue, setLocalValue] = React.useState(value);
  const [hasChanges, setHasChanges] = React.useState(false);

  // Update local value when prop changes
  React.useEffect(() => {
    setLocalValue(value);
    setHasChanges(false);
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setLocalValue(newValue);
    setHasChanges(newValue !== value);
    onChange(newValue);
  };

  const handleSave = async () => {
    if (!hasChanges || isSaving) return;
    await onSave();
    setHasChanges(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && hasChanges && !isSaving) {
      handleSave();
    }
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <label htmlFor={`api-key-${label}`} className="text-sm font-medium">
        {label}
      </label>
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            id={`api-key-${label}`}
            type={showKey ? 'text' : 'password'}
            value={localValue}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || t('openai.placeholder')}
            disabled={isSaving}
            className={cn(
              'w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              'disabled:cursor-not-allowed disabled:opacity-50',
              'placeholder:text-muted-foreground'
            )}
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            disabled={isSaving}
            aria-label={showKey ? t('hide') : t('show')}
            className={cn(
              'absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-sm',
              'hover:bg-muted transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:pointer-events-none disabled:opacity-50'
            )}
          >
            {showKey ? (
              <EyeOff className="h-4 w-4 text-muted-foreground" />
            ) : (
              <Eye className="h-4 w-4 text-muted-foreground" />
            )}
          </button>
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!hasChanges || isSaving}
          className={cn(
            'inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-all',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            'disabled:pointer-events-none disabled:opacity-50',
            isSaved
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          )}
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>{t('saving')}</span>
            </>
          ) : isSaved ? (
            <>
              <Check className="h-4 w-4" />
              <span>{t('saved')}</span>
            </>
          ) : (
            <span>{t('save')}</span>
          )}
        </button>
      </div>
    </div>
  );
}

