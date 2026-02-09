import * as React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import messages from "@/i18n/messages/en.json";
import ConfigurationPage from "@/app/[locale]/(app)/settings/configuration/page";

// Helper to render with intl
function renderWithIntl(component: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {component}
    </NextIntlClientProvider>,
  );
}

describe("Configuration Page", () => {
  it("should render the configuration page without errors", () => {
    // This test verifies the component renders without import errors or crashes
    const { container } = renderWithIntl(<ConfigurationPage />);
    expect(container).toBeTruthy();
    // Verify the component structure exists
    expect(container.querySelector('input[type="text"]')).toBeInTheDocument();
  });

  it("should display configuration input fields", () => {
    const { container } = renderWithIntl(<ConfigurationPage />);
    // Verify we have 4 input fields (DATABASE_URL, REDIS_URL, API_URL, OLLAMA_BASE_URL)
    const inputs = container.querySelectorAll('input[type="text"]');
    expect(inputs).toHaveLength(4);
  });
});

describe("Configuration Page Translations", () => {
  it("should have translations for Configuration section", () => {
    expect(messages.settings.configuration.title).toBe("Configuration");
    expect(messages.settings.configuration.description).toContain(
      "connection URLs",
    );
  });

  it("should have translations for Database URL", () => {
    expect(messages.settings.configuration.databaseUrl.label).toBe(
      "Database URL",
    );
    expect(messages.settings.configuration.databaseUrl.placeholder).toBe(
      "postgres://arbor:local_dev_only@localhost:5432/arbor_dev",
    );
    expect(messages.settings.configuration.databaseUrl.description).toContain(
      "PostgreSQL",
    );
  });

  it("should have translations for Redis URL", () => {
    expect(messages.settings.configuration.redisUrl.label).toBe("Redis URL");
    expect(messages.settings.configuration.redisUrl.placeholder).toBe(
      "redis://localhost:6379",
    );
    expect(messages.settings.configuration.redisUrl.description).toContain(
      "Redis",
    );
  });

  it("should have translations for API URL", () => {
    expect(messages.settings.configuration.apiUrl.label).toBe("API URL");
    expect(messages.settings.configuration.apiUrl.placeholder).toBe(
      "http://localhost:3001",
    );
    expect(messages.settings.configuration.apiUrl.description).toContain("API");
  });

  it("should have translations for Ollama Base URL", () => {
    expect(messages.settings.configuration.ollamaBaseUrl.label).toBe(
      "Ollama Base URL",
    );
    expect(messages.settings.configuration.ollamaBaseUrl.placeholder).toBe(
      "http://localhost:11434",
    );
    expect(messages.settings.configuration.ollamaBaseUrl.description).toContain(
      "Ollama",
    );
  });

  it("should have translations for action buttons", () => {
    expect(messages.settings.configuration.save).toBe("Save");
    expect(messages.settings.configuration.saved).toBe("Saved!");
    expect(messages.settings.configuration.saving).toBe("Saving...");
    expect(messages.settings.configuration.reset).toBe("Reset to Default");
  });
});
