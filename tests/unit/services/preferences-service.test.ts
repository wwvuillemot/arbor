import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { PreferencesService } from "@/services/preferences-service";
import { getTestDb, resetTestDb } from "@tests/helpers/db";
import { userPreferences } from "@/db/schema";

describe("PreferencesService", () => {
  let preferencesService: PreferencesService;
  const db = getTestDb();

  beforeEach(async () => {
    await resetTestDb();
    // Clean up preferences table
    await db.delete(userPreferences);
    preferencesService = new PreferencesService();
    // Wait for Redis connection
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  describe("App-scope preferences (PostgreSQL)", () => {
    it("should set and get an app preference", async () => {
      await preferencesService.setAppPreference("theme", "dark");
      const value = await preferencesService.getAppPreference("theme");

      expect(value).toBe("dark");
    });

    it("should return null for non-existent preference", async () => {
      const value = await preferencesService.getAppPreference("nonexistent");

      expect(value).toBeNull();
    });

    it("should update existing preference", async () => {
      await preferencesService.setAppPreference("theme", "light");
      await preferencesService.setAppPreference("theme", "dark");
      const value = await preferencesService.getAppPreference("theme");

      expect(value).toBe("dark");
    });

    it("should delete a preference", async () => {
      await preferencesService.setAppPreference("theme", "dark");
      await preferencesService.deleteAppPreference("theme");
      const value = await preferencesService.getAppPreference("theme");

      expect(value).toBeNull();
    });

    it("should get all app preferences", async () => {
      await preferencesService.setAppPreference("theme", "dark");
      await preferencesService.setAppPreference("language", "en");
      await preferencesService.setAppPreference("fontSize", 14);

      const prefs = await preferencesService.getAllAppPreferences();

      expect(prefs).toEqual({
        theme: "dark",
        language: "en",
        fontSize: 14,
      });
    });

    it("should store complex objects as preferences", async () => {
      const complexValue = {
        sidebar: { collapsed: true, width: 250 },
        panels: ["editor", "preview"],
      };

      await preferencesService.setAppPreference("layout", complexValue);
      const value = await preferencesService.getAppPreference("layout");

      expect(value).toEqual(complexValue);
    });
  });

  describe("Session-scope preferences (Redis)", () => {
    const sessionId = "test-session-123";

    it("should set and get a session preference", async () => {
      await preferencesService.setSessionPreference(
        sessionId,
        "tempView",
        "grid",
      );
      const value = await preferencesService.getSessionPreference(
        sessionId,
        "tempView",
      );

      expect(value).toBe("grid");
    });

    it("should return null for non-existent session preference", async () => {
      const value = await preferencesService.getSessionPreference(
        sessionId,
        "nonexistent",
      );

      expect(value).toBeNull();
    });

    it("should store different values for different sessions", async () => {
      const session1 = "session-1";
      const session2 = "session-2";

      await preferencesService.setSessionPreference(session1, "view", "list");
      await preferencesService.setSessionPreference(session2, "view", "grid");

      const value1 = await preferencesService.getSessionPreference(
        session1,
        "view",
      );
      const value2 = await preferencesService.getSessionPreference(
        session2,
        "view",
      );

      expect(value1).toBe("list");
      expect(value2).toBe("grid");
    });

    it("should delete a session preference", async () => {
      await preferencesService.setSessionPreference(
        sessionId,
        "tempView",
        "grid",
      );
      await preferencesService.deleteSessionPreference(sessionId, "tempView");
      const value = await preferencesService.getSessionPreference(
        sessionId,
        "tempView",
      );

      expect(value).toBeNull();
    });

    it("should store complex objects in session", async () => {
      const complexValue = {
        filters: { status: "active", tags: ["important"] },
        sort: { field: "date", order: "desc" },
      };

      await preferencesService.setSessionPreference(
        sessionId,
        "viewState",
        complexValue,
      );
      const value = await preferencesService.getSessionPreference(
        sessionId,
        "viewState",
      );

      expect(value).toEqual(complexValue);
    });

    it("should respect custom TTL", async () => {
      // Set with 1 second TTL
      await preferencesService.setSessionPreference(
        sessionId,
        "shortLived",
        "value",
        1,
      );

      // Should exist immediately
      let value = await preferencesService.getSessionPreference(
        sessionId,
        "shortLived",
      );
      expect(value).toBe("value");

      // Wait for expiration (add buffer for Redis processing time)
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Should be expired
      value = await preferencesService.getSessionPreference(
        sessionId,
        "shortLived",
      );
      expect(value).toBeNull();
    }, 5000);
  });
});
