import { describe, it, expect, beforeEach } from "vitest";
import { SettingsService } from "@server/services/settings-service";
import { getTestDb, resetTestDb } from "@tests/helpers/db";
import { appSettings } from "@server/db/schema";

describe("SettingsService", () => {
  let settingsService: SettingsService;
  const db = getTestDb();

  // Test master key (32 bytes base64-encoded)
  const testMasterKey = "YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=";

  beforeEach(async () => {
    await resetTestDb();
    // Clean up app_settings table
    await db.delete(appSettings);
    settingsService = new SettingsService();
  });

  describe("setSetting", () => {
    it("should encrypt and store a setting", async () => {
      await settingsService.setSetting(
        "openai_api_key",
        "sk-test-key-123",
        testMasterKey,
      );

      // Verify it was stored in database
      const [stored] = await db
        .select()
        .from(appSettings)
        .where((t) => t.key === "openai_api_key");

      expect(stored).toBeDefined();
      expect(stored.key).toBe("openai_api_key");
      expect(stored.encryptedValue).toBeDefined();
      expect(stored.iv).toBeDefined();
      // Encrypted value should not match plaintext
      expect(stored.encryptedValue).not.toBe("sk-test-key-123");
    });

    it("should update existing setting", async () => {
      await settingsService.setSetting(
        "openai_api_key",
        "old-key",
        testMasterKey,
      );
      await settingsService.setSetting(
        "openai_api_key",
        "new-key",
        testMasterKey,
      );

      const decrypted = await settingsService.getSetting(
        "openai_api_key",
        testMasterKey,
      );
      expect(decrypted).toBe("new-key");
    });

    it("should throw error for empty value", async () => {
      await expect(
        settingsService.setSetting("openai_api_key", "", testMasterKey),
      ).rejects.toThrow();
    });

    it("should throw error for empty key", async () => {
      await expect(
        settingsService.setSetting("", "value", testMasterKey),
      ).rejects.toThrow();
    });

    it("should throw error for invalid master key", async () => {
      await expect(
        settingsService.setSetting("openai_api_key", "value", "invalid-key"),
      ).rejects.toThrow();
    });
  });

  describe("getSetting", () => {
    it("should decrypt and return a setting", async () => {
      await settingsService.setSetting(
        "openai_api_key",
        "sk-test-key-123",
        testMasterKey,
      );

      const value = await settingsService.getSetting(
        "openai_api_key",
        testMasterKey,
      );

      expect(value).toBe("sk-test-key-123");
    });

    it("should return null for non-existent setting", async () => {
      const value = await settingsService.getSetting(
        "nonexistent",
        testMasterKey,
      );

      expect(value).toBeNull();
    });

    it("should throw error for wrong master key", async () => {
      await settingsService.setSetting(
        "openai_api_key",
        "sk-test-key-123",
        testMasterKey,
      );

      const wrongKey = "YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI=";
      await expect(
        settingsService.getSetting("openai_api_key", wrongKey),
      ).rejects.toThrow();
    });
  });

  describe("deleteSetting", () => {
    it("should delete a setting", async () => {
      await settingsService.setSetting(
        "openai_api_key",
        "sk-test-key-123",
        testMasterKey,
      );

      await settingsService.deleteSetting("openai_api_key");

      const value = await settingsService.getSetting(
        "openai_api_key",
        testMasterKey,
      );
      expect(value).toBeNull();
    });

    it("should not throw error when deleting non-existent setting", async () => {
      await expect(
        settingsService.deleteSetting("nonexistent"),
      ).resolves.not.toThrow();
    });
  });

  describe("getAllSettings", () => {
    it("should return all settings decrypted", async () => {
      await settingsService.setSetting(
        "openai_api_key",
        "sk-openai-123",
        testMasterKey,
      );
      await settingsService.setSetting(
        "anthropic_api_key",
        "sk-anthropic-456",
        testMasterKey,
      );

      const allSettings = await settingsService.getAllSettings(testMasterKey);

      expect(allSettings).toEqual({
        openai_api_key: "sk-openai-123",
        anthropic_api_key: "sk-anthropic-456",
      });
    });

    it("should return empty object when no settings exist", async () => {
      const allSettings = await settingsService.getAllSettings(testMasterKey);

      expect(allSettings).toEqual({});
    });

    it("should skip settings that fail to decrypt (graceful failure)", async () => {
      // Save two settings with the correct key
      await settingsService.setSetting(
        "openai_api_key",
        "sk-test-key-123",
        testMasterKey,
      );
      await settingsService.setSetting(
        "anthropic_api_key",
        "sk-ant-test-456",
        testMasterKey,
      );

      // Try to decrypt with wrong key - should return empty object
      const wrongKey = "YmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmJiYmI=";
      const result = await settingsService.getAllSettings(wrongKey);

      // Should return empty object (all settings failed to decrypt)
      expect(result).toEqual({});
    });
  });

  describe("hasSetting", () => {
    it("should return true if setting exists", async () => {
      await settingsService.setSetting(
        "openai_api_key",
        "sk-test-key-123",
        testMasterKey,
      );

      const exists = await settingsService.hasSetting("openai_api_key");

      expect(exists).toBe(true);
    });

    it("should return false if setting does not exist", async () => {
      const exists = await settingsService.hasSetting("nonexistent");

      expect(exists).toBe(false);
    });
  });
});
