"use client";

import * as React from "react";
import { useTranslations } from "next-intl";
import { ConfigInput } from "@/components/config-input";
import { trpc } from "@/lib/trpc";
import { Eye, EyeOff, Copy, Check } from "lucide-react";

// TODO: Replace with actual tRPC hooks when available
// For now, using placeholder hooks
function useConfiguration() {
  const [config, setConfig] = React.useState({
    DATABASE_URL: "",
    REDIS_URL: "",
    API_URL: "",
    OLLAMA_BASE_URL: "",
  });

  const [isCustomized, setIsCustomized] = React.useState({
    DATABASE_URL: false,
    REDIS_URL: false,
    API_URL: false,
    OLLAMA_BASE_URL: false,
  });

  // TODO: Load configuration from tRPC
  React.useEffect(() => {
    // Placeholder: Load from API
    setConfig({
      DATABASE_URL: "postgres://arbor:arbor@localhost:5432/arbor",
      REDIS_URL: "redis://localhost:6379",
      API_URL: "http://localhost:3001",
      OLLAMA_BASE_URL: "http://localhost:11434",
    });
  }, []);

  const setConfiguration = async (key: string, value: string) => {
    // TODO: Save to API via tRPC
    setConfig((prev) => ({ ...prev, [key]: value }));
    setIsCustomized((prev) => ({ ...prev, [key]: true }));
  };

  const resetConfiguration = async (key: string) => {
    // TODO: Reset via tRPC
    // For now, just reset to default
    const defaults = {
      DATABASE_URL: "postgres://arbor:arbor@localhost:5432/arbor",
      REDIS_URL: "redis://localhost:6379",
      API_URL: "http://localhost:3001",
      OLLAMA_BASE_URL: "http://localhost:11434",
    };
    setConfig((prev) => ({
      ...prev,
      [key]: defaults[key as keyof typeof defaults],
    }));
    setIsCustomized((prev) => ({ ...prev, [key]: false }));
  };

  return {
    config,
    isCustomized,
    setConfiguration,
    resetConfiguration,
  };
}

export default function ConfigurationPage() {
  const t = useTranslations("settings.configuration");
  const { config, isCustomized, setConfiguration, resetConfiguration } =
    useConfiguration();

  const [databaseUrl, setDatabaseUrl] = React.useState(config.DATABASE_URL);
  const [redisUrl, setRedisUrl] = React.useState(config.REDIS_URL);
  const [apiUrl, setApiUrl] = React.useState(config.API_URL);
  const [ollamaUrl, setOllamaUrl] = React.useState(config.OLLAMA_BASE_URL);

  const [saving, setSaving] = React.useState({
    DATABASE_URL: false,
    REDIS_URL: false,
    API_URL: false,
    OLLAMA_BASE_URL: false,
  });

  const [saved, setSaved] = React.useState({
    DATABASE_URL: false,
    REDIS_URL: false,
    API_URL: false,
    OLLAMA_BASE_URL: false,
  });

  // Master key state
  const [showMasterKey, setShowMasterKey] = React.useState(false);
  const [copiedMasterKey, setCopiedMasterKey] = React.useState(false);

  // Fetch master key from database
  const { data: masterKeyData, isLoading: isLoadingMasterKey } =
    trpc.preferences.getMasterKey.useQuery();

  // Update local state when config changes
  React.useEffect(() => {
    setDatabaseUrl(config.DATABASE_URL);
    setRedisUrl(config.REDIS_URL);
    setApiUrl(config.API_URL);
    setOllamaUrl(config.OLLAMA_BASE_URL);
  }, [config]);

  const handleSave = async (key: string, value: string) => {
    setSaving((prev) => ({ ...prev, [key]: true }));
    setSaved((prev) => ({ ...prev, [key]: false }));
    try {
      await setConfiguration(key, value);
      setSaved((prev) => ({ ...prev, [key]: true }));
      setTimeout(() => setSaved((prev) => ({ ...prev, [key]: false })), 2000);
    } catch (error) {
      console.error(`Failed to save ${key}:`, error);
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleReset = async (key: string) => {
    setSaving((prev) => ({ ...prev, [key]: true }));
    try {
      await resetConfiguration(key);
    } catch (error) {
      console.error(`Failed to reset ${key}:`, error);
    } finally {
      setSaving((prev) => ({ ...prev, [key]: false }));
    }
  };

  const handleCopyMasterKey = async () => {
    if (!masterKeyData?.masterKey) return;

    try {
      // Try modern clipboard API first
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(masterKeyData.masterKey);
      } else {
        // Fallback for older browsers or non-secure contexts
        const textarea = document.createElement("textarea");
        textarea.value = masterKeyData.masterKey;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setCopiedMasterKey(true);
      setTimeout(() => setCopiedMasterKey(false), 2000);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-2">{t("title")}</h1>
      <p className="text-muted-foreground mb-8">{t("description")}</p>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Connection Settings</h2>
        <div className="space-y-6">
          <ConfigInput
            label={t("databaseUrl.label")}
            description={t("databaseUrl.description")}
            placeholder={t("databaseUrl.placeholder")}
            value={databaseUrl}
            onChange={setDatabaseUrl}
            onSave={() => handleSave("DATABASE_URL", databaseUrl)}
            onReset={() => handleReset("DATABASE_URL")}
            isSaving={saving.DATABASE_URL}
            isSaved={saved.DATABASE_URL}
            isDefault={!isCustomized.DATABASE_URL}
          />

          <ConfigInput
            label={t("redisUrl.label")}
            description={t("redisUrl.description")}
            placeholder={t("redisUrl.placeholder")}
            value={redisUrl}
            onChange={setRedisUrl}
            onSave={() => handleSave("REDIS_URL", redisUrl)}
            onReset={() => handleReset("REDIS_URL")}
            isSaving={saving.REDIS_URL}
            isSaved={saved.REDIS_URL}
            isDefault={!isCustomized.REDIS_URL}
          />

          <ConfigInput
            label={t("apiUrl.label")}
            description={t("apiUrl.description")}
            placeholder={t("apiUrl.placeholder")}
            value={apiUrl}
            onChange={setApiUrl}
            onSave={() => handleSave("API_URL", apiUrl)}
            onReset={() => handleReset("API_URL")}
            isSaving={saving.API_URL}
            isSaved={saved.API_URL}
            isDefault={!isCustomized.API_URL}
          />

          <ConfigInput
            label={t("ollamaBaseUrl.label")}
            description={t("ollamaBaseUrl.description")}
            placeholder={t("ollamaBaseUrl.placeholder")}
            value={ollamaUrl}
            onChange={setOllamaUrl}
            onSave={() => handleSave("OLLAMA_BASE_URL", ollamaUrl)}
            onReset={() => handleReset("OLLAMA_BASE_URL")}
            isSaving={saving.OLLAMA_BASE_URL}
            isSaved={saved.OLLAMA_BASE_URL}
            isDefault={!isCustomized.OLLAMA_BASE_URL}
          />
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-4">{t("encryption.title")}</h2>
        <div className="space-y-4">
          <div className="border rounded-lg p-4 bg-card">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h3 className="font-medium">
                  {t("encryption.masterKey.label")}
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("encryption.masterKey.description")}
                </p>
              </div>
            </div>

            {isLoadingMasterKey ? (
              <div className="mt-4 text-sm text-muted-foreground">
                {t("encryption.masterKey.loading")}
              </div>
            ) : (
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <div className="flex-1 font-mono text-sm bg-muted p-3 rounded border">
                    {showMasterKey
                      ? masterKeyData?.masterKey ||
                        t("encryption.masterKey.notGenerated")
                      : "••••••••••••••••••••••••••••••••••••••••••"}
                  </div>
                  <button
                    onClick={() => setShowMasterKey(!showMasterKey)}
                    className="p-2 hover:bg-accent rounded transition-colors"
                    title={
                      showMasterKey
                        ? t("encryption.masterKey.hideKey")
                        : t("encryption.masterKey.showKey")
                    }
                  >
                    {showMasterKey ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={handleCopyMasterKey}
                    className="p-2 hover:bg-accent rounded transition-colors"
                    title={t("encryption.masterKey.copyToClipboard")}
                    disabled={!masterKeyData?.masterKey}
                  >
                    {copiedMasterKey ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {masterKeyData?.masterKey && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("encryption.masterKey.warning")}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
