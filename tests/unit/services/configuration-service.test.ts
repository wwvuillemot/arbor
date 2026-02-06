import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db';
import { userPreferences } from '@/db/schema';
import { eq, like } from 'drizzle-orm';
import { ConfigurationService } from '@/services/configuration-service';
import { DEFAULT_CONFIG, CONFIG_KEYS } from '@/config/defaults';

describe('ConfigurationService', () => {
  let configService: ConfigurationService;

  beforeEach(async () => {
    configService = new ConfigurationService();
    // Clean up test data
    await db.delete(userPreferences).where(like(userPreferences.key, 'config.%'));
  });

  describe('getConfiguration', () => {
    it('should return default value when configuration is not set', async () => {
      const databaseUrl = await configService.getConfiguration('DATABASE_URL');
      expect(databaseUrl).toBe(DEFAULT_CONFIG.DATABASE_URL);

      const redisUrl = await configService.getConfiguration('REDIS_URL');
      expect(redisUrl).toBe(DEFAULT_CONFIG.REDIS_URL);

      const apiUrl = await configService.getConfiguration('API_URL');
      expect(apiUrl).toBe(DEFAULT_CONFIG.API_URL);

      const ollamaUrl = await configService.getConfiguration('OLLAMA_BASE_URL');
      expect(ollamaUrl).toBe(DEFAULT_CONFIG.OLLAMA_BASE_URL);
    });

    it('should return stored value when configuration is set', async () => {
      // Set a custom database URL
      await db.insert(userPreferences).values({
        key: CONFIG_KEYS.DATABASE_URL,
        value: 'postgres://custom:custom@custom-host:5432/custom',
      });

      const databaseUrl = await configService.getConfiguration('DATABASE_URL');
      expect(databaseUrl).toBe('postgres://custom:custom@custom-host:5432/custom');
    });

    it('should return default when stored value is empty', async () => {
      // Set an empty value
      await db.insert(userPreferences).values({
        key: CONFIG_KEYS.DATABASE_URL,
        value: '',
      });

      const databaseUrl = await configService.getConfiguration('DATABASE_URL');
      expect(databaseUrl).toBe(DEFAULT_CONFIG.DATABASE_URL);
    });
  });

  describe('setConfiguration', () => {
    it('should store configuration value', async () => {
      await configService.setConfiguration('DATABASE_URL', 'postgres://new:new@new-host:5432/new');

      const [stored] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.key, CONFIG_KEYS.DATABASE_URL));

      expect(stored).toBeDefined();
      expect(stored.value).toBe('postgres://new:new@new-host:5432/new');
    });

    it('should update existing configuration', async () => {
      // Insert initial value
      await db.insert(userPreferences).values({
        key: CONFIG_KEYS.DATABASE_URL,
        value: 'postgres://old:old@old-host:5432/old',
      });

      // Update it
      await configService.setConfiguration('DATABASE_URL', 'postgres://updated:updated@updated-host:5432/updated');

      const [updated] = await db
        .select()
        .from(userPreferences)
        .where(eq(userPreferences.key, CONFIG_KEYS.DATABASE_URL));

      expect(updated.value).toBe('postgres://updated:updated@updated-host:5432/updated');
    });

    it('should store all configuration types', async () => {
      await configService.setConfiguration('DATABASE_URL', 'postgres://test:test@test:5432/test');
      await configService.setConfiguration('REDIS_URL', 'redis://test:6380');
      await configService.setConfiguration('API_URL', 'http://test:3002');
      await configService.setConfiguration('OLLAMA_BASE_URL', 'http://test:11435');

      const databaseUrl = await configService.getConfiguration('DATABASE_URL');
      const redisUrl = await configService.getConfiguration('REDIS_URL');
      const apiUrl = await configService.getConfiguration('API_URL');
      const ollamaUrl = await configService.getConfiguration('OLLAMA_BASE_URL');

      expect(databaseUrl).toBe('postgres://test:test@test:5432/test');
      expect(redisUrl).toBe('redis://test:6380');
      expect(apiUrl).toBe('http://test:3002');
      expect(ollamaUrl).toBe('http://test:11435');
    });
  });

  describe('getAllConfiguration', () => {
    it('should return all defaults when no configuration is set', async () => {
      const config = await configService.getAllConfiguration();

      expect(config).toEqual({
        DATABASE_URL: DEFAULT_CONFIG.DATABASE_URL,
        REDIS_URL: DEFAULT_CONFIG.REDIS_URL,
        API_URL: DEFAULT_CONFIG.API_URL,
        OLLAMA_BASE_URL: DEFAULT_CONFIG.OLLAMA_BASE_URL,
      });
    });

    it('should return mix of stored and default values', async () => {
      // Set only DATABASE_URL and REDIS_URL
      await db.insert(userPreferences).values([
        { key: CONFIG_KEYS.DATABASE_URL, value: 'postgres://custom:custom@custom:5432/custom' },
        { key: CONFIG_KEYS.REDIS_URL, value: 'redis://custom:6380' },
      ]);

      const config = await configService.getAllConfiguration();

      expect(config).toEqual({
        DATABASE_URL: 'postgres://custom:custom@custom:5432/custom',
        REDIS_URL: 'redis://custom:6380',
        API_URL: DEFAULT_CONFIG.API_URL, // Default
        OLLAMA_BASE_URL: DEFAULT_CONFIG.OLLAMA_BASE_URL, // Default
      });
    });
  });

  describe('resetConfiguration', () => {
    it('should delete configuration and return to default', async () => {
      // Set a custom value
      await configService.setConfiguration('DATABASE_URL', 'postgres://custom:custom@custom:5432/custom');

      // Verify it's set
      let databaseUrl = await configService.getConfiguration('DATABASE_URL');
      expect(databaseUrl).toBe('postgres://custom:custom@custom:5432/custom');

      // Reset it
      await configService.resetConfiguration('DATABASE_URL');

      // Verify it's back to default
      databaseUrl = await configService.getConfiguration('DATABASE_URL');
      expect(databaseUrl).toBe(DEFAULT_CONFIG.DATABASE_URL);
    });
  });
});

