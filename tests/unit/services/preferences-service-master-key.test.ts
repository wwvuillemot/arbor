import { describe, it, expect, beforeEach } from "vitest";
import { PreferencesService } from "@/services/preferences-service";
import { getTestDb, resetTestDb } from "@tests/helpers/db";
import { userPreferences } from "@/db/schema";

describe("PreferencesService - Master Key Management", () => {
  let preferencesService: PreferencesService;
  const db = getTestDb();

  beforeEach(async () => {
    // resetTestDb() is already called by the global beforeEach hook in tests/setup.ts
    preferencesService = new PreferencesService();
  });

  describe("generateMasterKey", () => {
    it("should generate a 32-byte base64-encoded master key", async () => {
      const masterKey = await preferencesService.generateMasterKey();

      // Base64-encoded 32 bytes = 44 characters (with padding)
      expect(masterKey).toHaveLength(44);
      expect(masterKey).toMatch(/^[A-Za-z0-9+/]+=*$/); // Valid base64
    });

    it("should generate a cryptographically random key", async () => {
      // Delete any existing key first
      await preferencesService.deletePreference("master_key");

      const key1 = await preferencesService.generateMasterKey();

      // Delete and generate again to verify randomness
      await preferencesService.deletePreference("master_key");
      const key2 = await preferencesService.generateMasterKey();

      // Two separately generated keys should be different (extremely high probability)
      expect(key1).not.toBe(key2);
    });

    it("should store the generated key in user_preferences", async () => {
      const masterKey = await preferencesService.generateMasterKey();

      const stored = await preferencesService.getPreference("master_key");
      expect(stored).toBe(masterKey);
    });

    it("should not overwrite existing master key", async () => {
      const key1 = await preferencesService.generateMasterKey();
      const key2 = await preferencesService.generateMasterKey();

      // Second call should return the existing key, not generate a new one
      expect(key2).toBe(key1);
    });
  });

  describe("getMasterKey", () => {
    it("should return null if no master key exists", async () => {
      const masterKey = await preferencesService.getMasterKey();
      expect(masterKey).toBeNull();
    });

    it("should return the stored master key", async () => {
      const generated = await preferencesService.generateMasterKey();
      const retrieved = await preferencesService.getMasterKey();

      expect(retrieved).toBe(generated);
    });

    it("should return the same key on multiple calls", async () => {
      await preferencesService.generateMasterKey();

      const key1 = await preferencesService.getMasterKey();
      const key2 = await preferencesService.getMasterKey();

      expect(key1).toBe(key2);
    });
  });

  describe("getOrGenerateMasterKey", () => {
    it("should generate a new key if none exists", async () => {
      const masterKey = await preferencesService.getOrGenerateMasterKey();

      expect(masterKey).toBeTruthy();
      expect(masterKey).toHaveLength(44);
    });

    it("should return existing key if one exists", async () => {
      const generated = await preferencesService.generateMasterKey();
      const retrieved = await preferencesService.getOrGenerateMasterKey();

      expect(retrieved).toBe(generated);
    });

    it("should be idempotent", async () => {
      const key1 = await preferencesService.getOrGenerateMasterKey();
      const key2 = await preferencesService.getOrGenerateMasterKey();
      const key3 = await preferencesService.getOrGenerateMasterKey();

      expect(key1).toBe(key2);
      expect(key2).toBe(key3);
    });
  });

  describe("integration with encryption", () => {
    it("should generate a key that works with EncryptionService", async () => {
      const { EncryptionService } =
        await import("@/services/encryption-service");
      const encryptionService = new EncryptionService();

      const masterKey = await preferencesService.generateMasterKey();
      const plaintext = "test-api-key-12345";

      // Should be able to encrypt and decrypt with the generated key
      const { encryptedValue, iv } = await encryptionService.encrypt(
        plaintext,
        masterKey,
      );
      const decrypted = await encryptionService.decrypt(
        encryptedValue,
        iv,
        masterKey,
      );

      expect(decrypted).toBe(plaintext);
    });
  });
});
