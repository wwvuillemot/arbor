import { describe, it, expect } from "vitest";
import messages from "@/i18n/messages/en.json";

describe("Integrations Page Translations", () => {
  it("should have translations for OpenAI API key", () => {
    expect(messages.settings.apiKeys.openai.label).toBe("OpenAI API Key");
    expect(messages.settings.apiKeys.openai.placeholder).toBe("sk-...");
    expect(messages.settings.apiKeys.openai.description).toContain("OpenAI");
  });

  it("should have translations for Anthropic API key", () => {
    expect(messages.settings.apiKeys.anthropic.label).toBe("Anthropic API Key");
    expect(messages.settings.apiKeys.anthropic.placeholder).toBe("sk-ant-...");
    expect(messages.settings.apiKeys.anthropic.description).toContain(
      "Anthropic",
    );
  });
});
