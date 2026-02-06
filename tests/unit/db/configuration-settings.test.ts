import { describe, it, expect, beforeEach } from 'vitest';
import { db } from '@/db';
import { userPreferences } from '@/db/schema';
import { eq, like } from 'drizzle-orm';

describe('Configuration Settings Schema', () => {
  beforeEach(async () => {
    // Clean up test data - delete all configuration keys
    await db.delete(userPreferences).where(like(userPreferences.key, 'config.%'));
  });

  it('should store DATABASE_URL configuration', async () => {
    const config = {
      key: 'config.database_url',
      value: 'postgres://arbor:arbor@localhost:5432/arbor',
    };

    const [inserted] = await db.insert(userPreferences).values(config).returning();
    expect(inserted).toBeDefined();
    expect(inserted.key).toBe('config.database_url');
    expect(inserted.value).toBe('postgres://arbor:arbor@localhost:5432/arbor');
  });

  it('should store REDIS_URL configuration', async () => {
    const config = {
      key: 'config.redis_url',
      value: 'redis://localhost:6379',
    };

    const [inserted] = await db.insert(userPreferences).values(config).returning();
    expect(inserted).toBeDefined();
    expect(inserted.key).toBe('config.redis_url');
    expect(inserted.value).toBe('redis://localhost:6379');
  });

  it('should store API_URL configuration', async () => {
    const config = {
      key: 'config.api_url',
      value: 'http://localhost:3001',
    };

    const [inserted] = await db.insert(userPreferences).values(config).returning();
    expect(inserted).toBeDefined();
    expect(inserted.key).toBe('config.api_url');
    expect(inserted.value).toBe('http://localhost:3001');
  });

  it('should store OLLAMA_BASE_URL configuration', async () => {
    const config = {
      key: 'config.ollama_base_url',
      value: 'http://localhost:11434',
    };

    const [inserted] = await db.insert(userPreferences).values(config).returning();
    expect(inserted).toBeDefined();
    expect(inserted.key).toBe('config.ollama_base_url');
    expect(inserted.value).toBe('http://localhost:11434');
  });

  it('should retrieve configuration settings', async () => {
    // Insert multiple configurations
    await db.insert(userPreferences).values([
      { key: 'config.database_url', value: 'postgres://arbor:arbor@localhost:5432/arbor' },
      { key: 'config.redis_url', value: 'redis://localhost:6379' },
      { key: 'config.api_url', value: 'http://localhost:3001' },
      { key: 'config.ollama_base_url', value: 'http://localhost:11434' },
    ]);

    // Retrieve all configuration preferences
    const configs = await db.select().from(userPreferences).where(like(userPreferences.key, 'config.%'));

    expect(configs).toHaveLength(4);
    expect(configs.map(c => c.key)).toContain('config.database_url');
    expect(configs.map(c => c.key)).toContain('config.redis_url');
    expect(configs.map(c => c.key)).toContain('config.api_url');
    expect(configs.map(c => c.key)).toContain('config.ollama_base_url');
  });

  it('should update existing configuration', async () => {
    // Insert initial value
    await db.insert(userPreferences).values({
      key: 'config.database_url',
      value: 'postgres://arbor:arbor@localhost:5432/arbor',
    });

    // Update the value
    await db
      .update(userPreferences)
      .set({ value: 'postgres://arbor:arbor@postgres:5432/arbor' })
      .where(eq(userPreferences.key, 'config.database_url'));

    // Retrieve and verify
    const [updated] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.key, 'config.database_url'));

    expect(updated.value).toBe('postgres://arbor:arbor@postgres:5432/arbor');
  });

  it('should delete configuration', async () => {
    // Insert a configuration
    await db.insert(userPreferences).values({
      key: 'config.database_url',
      value: 'postgres://arbor:arbor@localhost:5432/arbor',
    });

    // Delete it
    await db.delete(userPreferences).where(eq(userPreferences.key, 'config.database_url'));

    // Verify it's gone
    const configs = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.key, 'config.database_url'));

    expect(configs).toHaveLength(0);
  });
});

