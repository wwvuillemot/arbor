import { describe, it, expect, beforeEach } from "vitest";
import { appRouter } from "@/api/router";
import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { like } from "drizzle-orm";
import { DEFAULT_CONFIG } from "@/config/defaults";

describe("Configuration Router", () => {
  const caller = appRouter.createCaller({});

  beforeEach(async () => {
    // Clean up test data
    await db
      .delete(userPreferences)
      .where(like(userPreferences.key, "config.%"));
  });

  describe("getConfiguration", () => {
    it("should return default value when not set", async () => {
      const result = await caller.configuration.getConfiguration({
        key: "DATABASE_URL",
      });
      expect(result).toBe(DEFAULT_CONFIG.DATABASE_URL);
    });

    it("should return stored value when set", async () => {
      // Set a custom value first
      await caller.configuration.setConfiguration({
        key: "DATABASE_URL",
        value: "postgres://custom:custom@custom:5432/custom",
      });

      const result = await caller.configuration.getConfiguration({
        key: "DATABASE_URL",
      });
      expect(result).toBe("postgres://custom:custom@custom:5432/custom");
    });

    it("should work for all configuration keys", async () => {
      const databaseUrl = await caller.configuration.getConfiguration({
        key: "DATABASE_URL",
      });
      const redisUrl = await caller.configuration.getConfiguration({
        key: "REDIS_URL",
      });
      const apiUrl = await caller.configuration.getConfiguration({
        key: "API_URL",
      });
      const ollamaUrl = await caller.configuration.getConfiguration({
        key: "OLLAMA_BASE_URL",
      });

      expect(databaseUrl).toBe(DEFAULT_CONFIG.DATABASE_URL);
      expect(redisUrl).toBe(DEFAULT_CONFIG.REDIS_URL);
      expect(apiUrl).toBe(DEFAULT_CONFIG.API_URL);
      expect(ollamaUrl).toBe(DEFAULT_CONFIG.OLLAMA_BASE_URL);
    });
  });

  describe("setConfiguration", () => {
    it("should set configuration value", async () => {
      await caller.configuration.setConfiguration({
        key: "DATABASE_URL",
        value: "postgres://new:new@new:5432/new",
      });

      const result = await caller.configuration.getConfiguration({
        key: "DATABASE_URL",
      });
      expect(result).toBe("postgres://new:new@new:5432/new");
    });

    it("should update existing configuration", async () => {
      // Set initial value
      await caller.configuration.setConfiguration({
        key: "DATABASE_URL",
        value: "postgres://old:old@old:5432/old",
      });

      // Update it
      await caller.configuration.setConfiguration({
        key: "DATABASE_URL",
        value: "postgres://updated:updated@updated:5432/updated",
      });

      const result = await caller.configuration.getConfiguration({
        key: "DATABASE_URL",
      });
      expect(result).toBe("postgres://updated:updated@updated:5432/updated");
    });
  });

  describe("getAllConfiguration", () => {
    it("should return all defaults when nothing is set", async () => {
      const result = await caller.configuration.getAllConfiguration();

      expect(result).toEqual({
        DATABASE_URL: DEFAULT_CONFIG.DATABASE_URL,
        REDIS_URL: DEFAULT_CONFIG.REDIS_URL,
        API_URL: DEFAULT_CONFIG.API_URL,
        OLLAMA_BASE_URL: DEFAULT_CONFIG.OLLAMA_BASE_URL,
      });
    });

    it("should return mix of stored and default values", async () => {
      // Set only some values
      await caller.configuration.setConfiguration({
        key: "DATABASE_URL",
        value: "postgres://custom:custom@custom:5432/custom",
      });
      await caller.configuration.setConfiguration({
        key: "REDIS_URL",
        value: "redis://custom:6380",
      });

      const result = await caller.configuration.getAllConfiguration();

      expect(result).toEqual({
        DATABASE_URL: "postgres://custom:custom@custom:5432/custom",
        REDIS_URL: "redis://custom:6380",
        API_URL: DEFAULT_CONFIG.API_URL, // Default
        OLLAMA_BASE_URL: DEFAULT_CONFIG.OLLAMA_BASE_URL, // Default
      });
    });
  });

  describe("resetConfiguration", () => {
    it("should reset configuration to default", async () => {
      // Set a custom value
      await caller.configuration.setConfiguration({
        key: "DATABASE_URL",
        value: "postgres://custom:custom@custom:5432/custom",
      });

      // Verify it's set
      let result = await caller.configuration.getConfiguration({
        key: "DATABASE_URL",
      });
      expect(result).toBe("postgres://custom:custom@custom:5432/custom");

      // Reset it
      await caller.configuration.resetConfiguration({ key: "DATABASE_URL" });

      // Verify it's back to default
      result = await caller.configuration.getConfiguration({
        key: "DATABASE_URL",
      });
      expect(result).toBe(DEFAULT_CONFIG.DATABASE_URL);
    });
  });

  describe("isCustomized", () => {
    it("should return false for default values", async () => {
      const result = await caller.configuration.isCustomized({
        key: "DATABASE_URL",
      });
      expect(result).toBe(false);
    });

    it("should return true for customized values", async () => {
      await caller.configuration.setConfiguration({
        key: "DATABASE_URL",
        value: "postgres://custom:custom@custom:5432/custom",
      });

      const result = await caller.configuration.isCustomized({
        key: "DATABASE_URL",
      });
      expect(result).toBe(true);
    });
  });
});
