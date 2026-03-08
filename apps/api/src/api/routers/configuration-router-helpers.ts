import { z } from "zod";

export const configKeySchema = z.enum([
  "DATABASE_URL",
  "REDIS_URL",
  "API_URL",
  "OLLAMA_BASE_URL",
]);

const configValueSchema = z.string();

export const configurationKeyInputSchema = z.object({
  key: configKeySchema,
});

export const setConfigurationInputSchema = z.object({
  key: configKeySchema,
  value: configValueSchema,
});
