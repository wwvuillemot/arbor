import { describe, it, expect, beforeEach } from "vitest";
import { db } from "../../apps/api/src/db";
import { appSettings, userPreferences } from "../../apps/api/src/db/schema";
import { eq } from "drizzle-orm";
import { PreferencesService } from "../../apps/api/src/services/preferences-service";
import { SettingsService } from "../../apps/api/src/services/settings-service";
import { EncryptionService } from "../../apps/api/src/services/encryption-service";

describe("API Key Persistence - Integration Test", () => {
  let preferencesService: PreferencesService;
  let settingsService: SettingsService;
  let encryptionService: EncryptionService;

  beforeEach(async () => {
    // Clean database
    await db.delete(appSettings);
    await db.delete(userPreferences);

    // Create fresh service instances
    preferencesService = new PreferencesService();
    encryptionService = new EncryptionService();
    settingsService = new SettingsService(encryptionService);
  });

  it("CRITICAL: Master key should NEVER be regenerated if it already exists", async () => {
    // Step 1: Generate initial master key
    const masterKey1 = await preferencesService.generateMasterKey();
    console.log("Generated master key 1:", masterKey1);

    // Step 2: Try to generate again - should return SAME key
    const masterKey2 = await preferencesService.generateMasterKey();
    console.log("Generated master key 2:", masterKey2);

    // THIS MUST PASS - same key should be returned
    expect(masterKey2).toBe(masterKey1);

    // Step 3: Verify only ONE master key exists in database
    const allKeys = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.key, "master_key"));

    expect(allKeys).toHaveLength(1);
    expect(allKeys[0].value).toBe(masterKey1);
  });

  it("CRITICAL: API keys encrypted with master key should decrypt correctly after reload", async () => {
    // Step 1: Generate master key
    const masterKey = await preferencesService.generateMasterKey();
    console.log("Master key:", masterKey);

    // Step 2: Save an API key
    const testApiKey = "sk-test-1234567890abcdef";
    await settingsService.setSetting("openai_api_key", testApiKey, masterKey);
    console.log("Saved API key");

    // Step 3: Verify it's encrypted in database
    const encrypted = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, "openai_api_key"));

    expect(encrypted).toHaveLength(1);
    expect(encrypted[0].encryptedValue).not.toBe(testApiKey);
    console.log("Encrypted value:", encrypted[0].encryptedValue);

    // Step 4: SIMULATE RELOAD - get master key from database
    const retrievedMasterKey = await preferencesService.getMasterKey();
    console.log("Retrieved master key:", retrievedMasterKey);

    expect(retrievedMasterKey).toBe(masterKey);

    // Step 5: Decrypt with retrieved master key
    const decrypted = await settingsService.getSetting(
      "openai_api_key",
      retrievedMasterKey!,
    );
    console.log("Decrypted value:", decrypted);

    // THIS MUST PASS - decrypted value should match original
    expect(decrypted).toBe(testApiKey);
  });

  it("CRITICAL: Multiple API keys should persist across simulated reloads", async () => {
    // Step 1: Generate master key
    const masterKey = await preferencesService.generateMasterKey();

    // Step 2: Save multiple API keys
    await settingsService.setSetting(
      "openai_api_key",
      "sk-openai-test-key",
      masterKey,
    );
    await settingsService.setSetting(
      "anthropic_api_key",
      "sk-ant-test-key",
      masterKey,
    );

    // Step 3: SIMULATE RELOAD - create new service instances
    const newPreferencesService = new PreferencesService();
    const newEncryptionService = new EncryptionService();
    const newSettingsService = new SettingsService(newEncryptionService);

    // Step 4: Get master key from database
    const retrievedMasterKey = await newPreferencesService.getMasterKey();
    expect(retrievedMasterKey).toBe(masterKey);

    // Step 5: Get all settings
    const allSettings = await newSettingsService.getAllSettings(
      retrievedMasterKey!,
    );

    // THIS MUST PASS - all keys should be retrievable
    expect(allSettings).toHaveProperty("openai_api_key", "sk-openai-test-key");
    expect(allSettings).toHaveProperty("anthropic_api_key", "sk-ant-test-key");
  });

  it("CRITICAL: getOrGenerateMasterKey should NEVER regenerate existing key", async () => {
    // Step 1: Generate initial master key
    const masterKey1 = await preferencesService.generateMasterKey();

    // Step 2: Call getOrGenerateMasterKey multiple times
    const masterKey2 = await preferencesService.getOrGenerateMasterKey();
    const masterKey3 = await preferencesService.getOrGenerateMasterKey();
    const masterKey4 = await preferencesService.getOrGenerateMasterKey();

    // ALL MUST BE THE SAME
    expect(masterKey2).toBe(masterKey1);
    expect(masterKey3).toBe(masterKey1);
    expect(masterKey4).toBe(masterKey1);

    // Verify only ONE master key in database
    const allKeys = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.key, "master_key"));

    expect(allKeys).toHaveLength(1);
  });

  it("CRITICAL: Master key should survive database queries", async () => {
    // Step 1: Generate master key
    const masterKey = await preferencesService.generateMasterKey();

    // Step 2: Do some other database operations
    await preferencesService.setPreference("setup_completed", true);
    await preferencesService.setPreference("some_other_pref", "value");

    // Step 3: Master key should still be there
    const retrievedMasterKey = await preferencesService.getMasterKey();
    expect(retrievedMasterKey).toBe(masterKey);

    // Step 4: Verify it's still in database
    const dbKey = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.key, "master_key"));

    expect(dbKey).toHaveLength(1);
    expect(dbKey[0].value).toBe(masterKey);
  });
});

