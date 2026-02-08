"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ApiKeyInput } from "@/components/api-key-input";
import { useApiKeys } from "@/hooks/use-api-keys";

export default function IntegrationsPage() {
  const t = useTranslations("settings");
  const tApiKeys = useTranslations("settings.apiKeys");
  const { apiKeys, getApiKey, setApiKey, isLoading } = useApiKeys();

  const [openaiKey, setOpenaiKey] = React.useState("");
  const [openaiSaving, setOpenaiSaving] = React.useState(false);
  const [openaiSaved, setOpenaiSaved] = React.useState(false);

  const [anthropicKey, setAnthropicKey] = React.useState("");
  const [anthropicSaving, setAnthropicSaving] = React.useState(false);
  const [anthropicSaved, setAnthropicSaved] = React.useState(false);

  // Load API keys when available
  React.useEffect(() => {
    // Only update if we're not currently loading
    if (!isLoading) {
      const openai = getApiKey("openai_api_key");
      // Always update state, even if value is empty string
      // This ensures we show the actual saved value (which might be empty)
      setOpenaiKey(openai || "");

      const anthropic = getApiKey("anthropic_api_key");
      setAnthropicKey(anthropic || "");
    }
  }, [getApiKey, apiKeys, isLoading]);

  const handleSaveOpenAIKey = async () => {
    setOpenaiSaving(true);
    setOpenaiSaved(false);
    try {
      await setApiKey("openai_api_key", openaiKey);
      setOpenaiSaved(true);
      // Reset saved state after 2 seconds
      setTimeout(() => setOpenaiSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save OpenAI API key:", error);
    } finally {
      setOpenaiSaving(false);
    }
  };

  const handleSaveAnthropicKey = async () => {
    setAnthropicSaving(true);
    setAnthropicSaved(false);
    try {
      await setApiKey("anthropic_api_key", anthropicKey);
      setAnthropicSaved(true);
      // Reset saved state after 2 seconds
      setTimeout(() => setAnthropicSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save Anthropic API key:", error);
    } finally {
      setAnthropicSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">{t("nav.integrations")}</h1>
      <p className="text-muted-foreground mb-8">
        Connect Arbor with external services and AI providers.
      </p>

      {/* API Keys Section */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-2">{tApiKeys("title")}</h2>
        <p className="text-sm text-muted-foreground mb-4">
          {tApiKeys("description")}
        </p>

        {isLoading ? (
          <div className="text-sm text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-6">
            <ApiKeyInput
              label={tApiKeys("openai.label")}
              description={tApiKeys("openai.description")}
              placeholder={tApiKeys("openai.placeholder")}
              value={openaiKey}
              onChange={setOpenaiKey}
              onSave={handleSaveOpenAIKey}
              isSaving={openaiSaving}
              isSaved={openaiSaved}
            />

            <ApiKeyInput
              label={tApiKeys("anthropic.label")}
              description={tApiKeys("anthropic.description")}
              placeholder={tApiKeys("anthropic.placeholder")}
              value={anthropicKey}
              onChange={setAnthropicKey}
              onSave={handleSaveAnthropicKey}
              isSaving={anthropicSaving}
              isSaved={anthropicSaved}
            />
          </div>
        )}
      </section>
    </div>
  );
}
