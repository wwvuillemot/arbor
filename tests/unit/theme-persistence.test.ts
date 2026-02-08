import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/db";
import { userPreferences } from "@/db/schema";
import { eq } from "drizzle-orm";

describe("Theme Persistence Bug Fixes", () => {
  beforeEach(async () => {
    // Clean up theme preferences before each test
    await db.delete(userPreferences).where(eq(userPreferences.key, "theme"));
  });

  describe("Theme preference persistence", () => {
    it("should save light theme to database", async () => {
      // Set theme to light
      await db.insert(userPreferences).values({
        key: "theme",
        value: "light",
      });

      // Verify it was saved
      const saved = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.key, "theme"));

      expect(saved.length).toBe(1);
      expect(saved[0].value).toBe("light");
    });

    it("should save dark theme to database", async () => {
      // Set theme to dark
      await db.insert(userPreferences).values({
        key: "theme",
        value: "dark",
      });

      // Verify it was saved
      const saved = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.key, "theme"));

      expect(saved.length).toBe(1);
      expect(saved[0].value).toBe("dark");
    });

    it("should save system theme to database", async () => {
      // Set theme to system
      await db.insert(userPreferences).values({
        key: "theme",
        value: "system",
      });

      // Verify it was saved
      const saved = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.key, "theme"));

      expect(saved.length).toBe(1);
      expect(saved[0].value).toBe("system");
    });

    it("should update existing theme preference", async () => {
      // Set initial theme
      await db.insert(userPreferences).values({
        key: "theme",
        value: "dark",
      });

      // Update to light
      await db
        .update(userPreferences)
        .set({ value: "light" })
        .where(eq(userPreferences.key, "theme"));

      // Verify it was updated
      const updated = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.key, "theme"));

      expect(updated.length).toBe(1);
      expect(updated[0].value).toBe("light");
    });

    it("should persist theme across simulated page reloads", async () => {
      // Set theme to light
      await db.insert(userPreferences).values({
        key: "theme",
        value: "light",
      });

      // Simulate page reload by fetching theme again
      const reloaded = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.key, "theme"));

      expect(reloaded.length).toBe(1);
      expect(reloaded[0].value).toBe("light");

      // Change to dark
      await db
        .update(userPreferences)
        .set({ value: "dark" })
        .where(eq(userPreferences.key, "theme"));

      // Simulate another reload
      const reloadedAgain = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.key, "theme"));

      expect(reloadedAgain.length).toBe(1);
      expect(reloadedAgain[0].value).toBe("dark");
    });

    it("should default to system if no theme preference exists", async () => {
      // Don't set any theme preference

      // Try to fetch theme
      const theme = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.key, "theme"));

      // Should be empty (will default to 'system' in the hook)
      expect(theme.length).toBe(0);
    });
  });
});
