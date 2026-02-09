/**
 * Default configuration values for Arbor
 *
 * These values are used when configuration settings are not explicitly set.
 * They provide sensible defaults that work out of the box for local development.
 */

export const DEFAULT_CONFIG = {
  /**
   * PostgreSQL database connection URL
   * Default: Local PostgreSQL instance with arbor user and arbor_dev database
   */
  DATABASE_URL: "postgres://arbor:local_dev_only@localhost:5432/arbor_dev",

  /**
   * Redis connection URL
   * Default: Local Redis instance on default port
   */
  REDIS_URL: "redis://localhost:6379",

  /**
   * API server URL
   * Default: Local API server on port 3001
   */
  API_URL: "http://localhost:3001",

  /**
   * Ollama base URL for local LLM inference
   * Default: Local Ollama instance on default port
   */
  OLLAMA_BASE_URL: "http://localhost:11434",
} as const;

/**
 * Configuration keys used in the database
 * Prefixed with 'config.' to namespace them in user_preferences table
 */
export const CONFIG_KEYS = {
  DATABASE_URL: "config.database_url",
  REDIS_URL: "config.redis_url",
  API_URL: "config.api_url",
  OLLAMA_BASE_URL: "config.ollama_base_url",
} as const;

export type ConfigKey = keyof typeof DEFAULT_CONFIG;
export type ConfigValue = (typeof DEFAULT_CONFIG)[ConfigKey];
