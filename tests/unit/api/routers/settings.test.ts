import { describe, it, expect, beforeEach, vi } from 'vitest';
import { appRouter } from '@server/api/router';
import { createContext } from '@server/api/trpc';
import { getTestDb, resetTestDb } from '@tests/helpers/db';
import { appSettings } from '@server/db/schema';

// Mock the Tauri keyring commands
const mockGetMasterKey = vi.fn().mockResolvedValue('YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=');

// Mock Tauri invoke
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((command: string) => {
    if (command === 'get_master_key') {
      return mockGetMasterKey();
    }
    throw new Error(`Unknown command: ${command}`);
  }),
}));

describe('Settings Router', () => {
  const db = getTestDb();
  const testMasterKey = 'YWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWE=';

  // Create a test caller
  const createCaller = () => {
    const ctx = createContext({
      req: {} as any,
      res: {} as any,
    });
    return appRouter.createCaller(ctx);
  };

  beforeEach(async () => {
    await resetTestDb();
    await db.delete(appSettings);
  });

  describe('setSetting', () => {
    it('should set a setting', async () => {
      const caller = createCaller();

      const result = await caller.settings.setSetting({
        key: 'openai_api_key',
        value: 'sk-test-key-123',
        masterKey: testMasterKey,
      });

      expect(result.success).toBe(true);
      expect(result.key).toBe('openai_api_key');
    });

    it('should update existing setting', async () => {
      const caller = createCaller();

      await caller.settings.setSetting({
        key: 'openai_api_key',
        value: 'old-key',
        masterKey: testMasterKey,
      });

      const result = await caller.settings.setSetting({
        key: 'openai_api_key',
        value: 'new-key',
        masterKey: testMasterKey,
      });

      expect(result.success).toBe(true);

      // Verify the value was updated
      const retrieved = await caller.settings.getSetting({
        key: 'openai_api_key',
        masterKey: testMasterKey,
      });

      expect(retrieved.value).toBe('new-key');
    });
  });

  describe('getSetting', () => {
    it('should get a setting', async () => {
      const caller = createCaller();

      await caller.settings.setSetting({
        key: 'openai_api_key',
        value: 'sk-test-key-123',
        masterKey: testMasterKey,
      });

      const result = await caller.settings.getSetting({
        key: 'openai_api_key',
        masterKey: testMasterKey,
      });

      expect(result.key).toBe('openai_api_key');
      expect(result.value).toBe('sk-test-key-123');
    });

    it('should return null for non-existent setting', async () => {
      const caller = createCaller();

      const result = await caller.settings.getSetting({
        key: 'nonexistent',
        masterKey: testMasterKey,
      });

      expect(result.key).toBe('nonexistent');
      expect(result.value).toBeNull();
    });
  });

  describe('deleteSetting', () => {
    it('should delete a setting', async () => {
      const caller = createCaller();

      await caller.settings.setSetting({
        key: 'openai_api_key',
        value: 'sk-test-key-123',
        masterKey: testMasterKey,
      });

      const result = await caller.settings.deleteSetting({
        key: 'openai_api_key',
      });

      expect(result.success).toBe(true);

      // Verify it was deleted
      const retrieved = await caller.settings.getSetting({
        key: 'openai_api_key',
        masterKey: testMasterKey,
      });

      expect(retrieved.value).toBeNull();
    });
  });

  describe('getAllSettings', () => {
    it('should get all settings', async () => {
      const caller = createCaller();

      await caller.settings.setSetting({
        key: 'openai_api_key',
        value: 'sk-openai-123',
        masterKey: testMasterKey,
      });

      await caller.settings.setSetting({
        key: 'anthropic_api_key',
        value: 'sk-anthropic-456',
        masterKey: testMasterKey,
      });

      const result = await caller.settings.getAllSettings({
        masterKey: testMasterKey,
      });

      expect(result).toEqual({
        openai_api_key: 'sk-openai-123',
        anthropic_api_key: 'sk-anthropic-456',
      });
    });
  });
});

