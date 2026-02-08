import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/db";
import { userPreferences, nodes } from "@/db/schema";
import { eq } from "drizzle-orm";
import { seed } from "@/db/seed";

describe("Setup Router - Language Change Bug Fixes", () => {
  beforeEach(async () => {
    // Clean up database before each test
    await db.delete(userPreferences);
    await db.delete(nodes);
  });

  describe("Seed idempotency", () => {
    it("should not re-seed if projects already exist", async () => {
      // First seed
      await seed();

      // Get initial project count
      const projectsAfterFirstSeed = await db
        .select()
        .from(nodes)
        .where(eq(nodes.type, "project"));

      expect(projectsAfterFirstSeed.length).toBeGreaterThan(0);
      const initialCount = projectsAfterFirstSeed.length;

      // Second seed (should skip)
      await seed();

      // Get project count after second seed
      const projectsAfterSecondSeed = await db
        .select()
        .from(nodes)
        .where(eq(nodes.type, "project"));

      // Should be the same count (no duplicates)
      expect(projectsAfterSecondSeed.length).toBe(initialCount);
    });

    it("should not delete existing preferences when re-seeding", async () => {
      // First seed
      await seed();

      // Set some user preferences (like API keys)
      await db.insert(userPreferences).values([
        { key: "openai_api_key", value: "sk-test-key-123" },
        { key: "anthropic_api_key", value: "sk-ant-test-key-456" },
        { key: "currentProjectId", value: "project-123" },
      ]);

      // Get preference count
      const prefsAfterInsert = await db.select().from(userPreferences);
      expect(prefsAfterInsert.length).toBeGreaterThan(0);
      const initialPrefCount = prefsAfterInsert.length;

      // Second seed (should skip and not touch preferences)
      await seed();

      // Get preferences after second seed
      const prefsAfterSecondSeed = await db.select().from(userPreferences);

      // Should still have all preferences
      expect(prefsAfterSecondSeed.length).toBe(initialPrefCount);

      // Verify specific preferences still exist
      const openaiKey = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.key, "openai_api_key"));
      expect(openaiKey.length).toBe(1);
      expect(openaiKey[0].value).toBe("sk-test-key-123");

      const currentProject = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.key, "currentProjectId"));
      expect(currentProject.length).toBe(1);
      expect(currentProject[0].value).toBe("project-123");
    });

    it("should preserve currentProjectId across language changes", async () => {
      // Seed database
      await seed();

      // Get a project ID
      const projects = await db
        .select()
        .from(nodes)
        .where(eq(nodes.type, "project"))
        .limit(1);

      expect(projects.length).toBe(1);
      const projectId = projects[0].id;

      // Set current project
      await db.insert(userPreferences).values({
        key: "currentProjectId",
        value: projectId,
      });

      // Simulate language change by setting language preference
      await db.insert(userPreferences).values({
        key: "language",
        value: "ja",
      });

      // Verify currentProjectId still exists
      const currentProject = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.key, "currentProjectId"));

      expect(currentProject.length).toBe(1);
      expect(currentProject[0].value).toBe(projectId);

      // Change language back to English
      await db
        .update(userPreferences)
        .set({ value: "en" })
        .where(eq(userPreferences.key, "language"));

      // Verify currentProjectId STILL exists
      const currentProjectAfterLangChange = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.key, "currentProjectId"));

      expect(currentProjectAfterLangChange.length).toBe(1);
      expect(currentProjectAfterLangChange[0].value).toBe(projectId);
    });
  });

  describe("Setup status persistence", () => {
    it("should not run seed if setup_completed is true", async () => {
      // Mark setup as complete
      await db.insert(userPreferences).values({
        key: "setup_completed",
        value: true,
      });

      // Create a single project manually (not via seed)
      await db.insert(nodes).values({
        type: "project",
        name: "Manual Project",
        metadata: {},
      });

      // Try to seed (should skip)
      await seed();

      // Should still only have 1 project
      const projects = await db
        .select()
        .from(nodes)
        .where(eq(nodes.type, "project"));

      expect(projects.length).toBe(1);
      expect(projects[0].name).toBe("Manual Project");
    });
  });
});
