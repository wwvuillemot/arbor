import { eq } from "drizzle-orm";

import { db } from "../db/index";
import { userPreferences } from "../db/schema";

export async function getStoredAppPreference(key: string): Promise<any | null> {
  const [preferenceRecord] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.key, key));

  return preferenceRecord ? preferenceRecord.value : null;
}

export async function hasStoredAppPreference(key: string): Promise<boolean> {
  const [preferenceRecord] = await db
    .select({ key: userPreferences.key })
    .from(userPreferences)
    .where(eq(userPreferences.key, key));

  return Boolean(preferenceRecord);
}

export async function setStoredAppPreference(
  key: string,
  value: any,
): Promise<void> {
  const preferenceExists = await hasStoredAppPreference(key);

  if (preferenceExists) {
    await db
      .update(userPreferences)
      .set({ value })
      .where(eq(userPreferences.key, key));

    return;
  }

  await db.insert(userPreferences).values({ key, value });
}

export async function deleteStoredAppPreference(key: string): Promise<void> {
  await db.delete(userPreferences).where(eq(userPreferences.key, key));
}

export async function listStoredAppPreferences(): Promise<Record<string, any>> {
  const preferenceRecords = await db.select().from(userPreferences);

  return preferenceRecords.reduce(
    (preferencesByKey, preferenceRecord) => {
      preferencesByKey[preferenceRecord.key] = preferenceRecord.value;
      return preferencesByKey;
    },
    {} as Record<string, any>,
  );
}
