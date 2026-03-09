import { z } from "zod";
import { SettingsService } from "../../services/settings-service";

const settingKeySchema = z.string();
const settingValueSchema = z.string();
const masterKeySchema = z.string();

export const getSettingInputSchema = z.object({
  key: settingKeySchema,
  masterKey: masterKeySchema,
});

export const getAllSettingsInputSchema = z.object({
  masterKey: masterKeySchema,
});

export const setSettingInputSchema = z.object({
  key: settingKeySchema,
  value: settingValueSchema,
  masterKey: masterKeySchema,
});

export const deleteSettingInputSchema = z.object({
  key: settingKeySchema,
});

export const hasSettingInputSchema = z.object({
  key: settingKeySchema,
});

export function createSettingValueResponse(key: string, value: string | null) {
  return { key, value };
}

export function createSettingSuccessResponse(key: string) {
  return { success: true, key };
}

export function createSettingExistsResponse(key: string, exists: boolean) {
  return { key, exists };
}

export async function getAllSettingsOrEmpty(
  settingsService: SettingsService,
  masterKey: string,
) {
  try {
    return await settingsService.getAllSettings(masterKey);
  } catch (error) {
    console.error("Failed to get all settings:", error);
    return {};
  }
}
