'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { ApiKeyInput } from '@/components/api-key-input';
import { useApiKeys } from '@/hooks/use-api-keys';

export default function IntegrationsPage() {
  const t = useTranslations('settings');
  const tApiKeys = useTranslations('settings.apiKeys');
  const { apiKeys, getApiKey, setApiKey, isUpdating, isLoading } = useApiKeys();

  const [openaiKey, setOpenaiKey] = React.useState('');
  const [isSaving, setIsSaving] = React.useState(false);
  const [isSaved, setIsSaved] = React.useState(false);

  // Load OpenAI key when available
  React.useEffect(() => {
    const key = getApiKey('openai_api_key');
    if (key) {
      setOpenaiKey(key);
    }
  }, [getApiKey, apiKeys]);

  const handleSaveOpenAIKey = async () => {
    setIsSaving(true);
    setIsSaved(false);
    try {
      await setApiKey('openai_api_key', openaiKey);
      setIsSaved(true);
      // Reset saved state after 2 seconds
      setTimeout(() => setIsSaved(false), 2000);
    } catch (error) {
      console.error('Failed to save OpenAI API key:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">{t('nav.integrations')}</h1>
      <p className="text-muted-foreground mb-8">
        Connect Arbor with external services and AI providers.
      </p>

      {/* API Keys Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">{tApiKeys('title')}</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {tApiKeys('description')}
        </p>
        
        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-6">
            <ApiKeyInput
              label={tApiKeys('openai.label')}
              description={tApiKeys('openai.description')}
              placeholder={tApiKeys('openai.placeholder')}
              value={openaiKey}
              onChange={setOpenaiKey}
              onSave={handleSaveOpenAIKey}
              isSaving={isSaving}
              isSaved={isSaved}
            />
          </div>
        )}
      </section>
    </div>
  );
}

