import { describe, it, expect, beforeEach } from "vitest";
import { getTestDb, resetTestDb } from "@tests/helpers/db";
import { appSettings } from "@server/db/schema";
import { eq } from "drizzle-orm";

describe("Database - App Settings Table", () => {
  const db = getTestDb();

  beforeEach(async () => {
    await resetTestDb();
    // Clean up app_settings table
    await db.delete(appSettings);
  });

  describe("Setting Creation", () => {
    it("should create a setting with encrypted value and IV", async () => {
      const [setting] = await db
        .insert(appSettings)
        .values({
          key: "openai_api_key",
          encryptedValue: "base64_encrypted_value",
          iv: "base64_iv_value",
        })
        .returning();

      expect(setting).toBeDefined();
      expect(setting.id).toBeDefined();
      expect(setting.key).toBe("openai_api_key");
      expect(setting.encryptedValue).toBe("base64_encrypted_value");
      expect(setting.iv).toBe("base64_iv_value");
      expect(setting.createdAt).toBeDefined();
      expect(setting.updatedAt).toBeDefined();
    });

    it("should enforce unique key constraint", async () => {
      await db.insert(appSettings).values({
        key: "openai_api_key",
        encryptedValue: "value1",
        iv: "iv1",
      });

      // Attempt to insert duplicate key
      await expect(
        db.insert(appSettings).values({
          key: "openai_api_key",
          encryptedValue: "value2",
          iv: "iv2",
        }),
      ).rejects.toThrow();
    });

    it("should require all fields", async () => {
      // Missing encryptedValue
      await expect(
        db.insert(appSettings).values({
          key: "test_key",
          iv: "test_iv",
        } as any),
      ).rejects.toThrow();

      // Missing iv
      await expect(
        db.insert(appSettings).values({
          key: "test_key",
          encryptedValue: "test_value",
        } as any),
      ).rejects.toThrow();

      // Missing key
      await expect(
        db.insert(appSettings).values({
          encryptedValue: "test_value",
          iv: "test_iv",
        } as any),
      ).rejects.toThrow();
    });
  });

  describe("Setting Retrieval", () => {
    it("should retrieve a setting by key", async () => {
      await db.insert(appSettings).values({
        key: "openai_api_key",
        encryptedValue: "encrypted_value",
        iv: "iv_value",
      });

      const [setting] = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, "openai_api_key"));

      expect(setting).toBeDefined();
      expect(setting.key).toBe("openai_api_key");
      expect(setting.encryptedValue).toBe("encrypted_value");
      expect(setting.iv).toBe("iv_value");
    });

    it("should return empty array for non-existent key", async () => {
      const results = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, "nonexistent"));

      expect(results).toHaveLength(0);
    });

    it("should retrieve all settings", async () => {
      await db.insert(appSettings).values([
        { key: "openai_api_key", encryptedValue: "value1", iv: "iv1" },
        { key: "anthropic_api_key", encryptedValue: "value2", iv: "iv2" },
      ]);

      const allSettings = await db.select().from(appSettings);

      expect(allSettings).toHaveLength(2);
    });
  });

  describe("Setting Update", () => {
    it("should update encrypted value and IV", async () => {
      const [original] = await db
        .insert(appSettings)
        .values({
          key: "openai_api_key",
          encryptedValue: "old_value",
          iv: "old_iv",
        })
        .returning();

      // Small delay to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      await db
        .update(appSettings)
        .set({
          encryptedValue: "new_value",
          iv: "new_iv",
          updatedAt: new Date(),
        })
        .where(eq(appSettings.key, "openai_api_key"));

      const [updated] = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, "openai_api_key"));

      expect(updated.encryptedValue).toBe("new_value");
      expect(updated.iv).toBe("new_iv");
      expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
        original.updatedAt.getTime(),
      );
    });
  });

  describe("Setting Deletion", () => {
    it("should delete a setting", async () => {
      await db.insert(appSettings).values({
        key: "openai_api_key",
        encryptedValue: "value",
        iv: "iv",
      });

      await db.delete(appSettings).where(eq(appSettings.key, "openai_api_key"));

      const results = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, "openai_api_key"));

      expect(results).toHaveLength(0);
    });
  });
});
