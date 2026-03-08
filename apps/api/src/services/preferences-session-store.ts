import { createClient } from "redis";

const DEFAULT_SESSION_PREFERENCE_TTL_SECONDS = 86_400;

export type SessionPreferencesRedisClient = ReturnType<typeof createClient>;

export function createSessionPreferencesRedisClient(
  redisUrl: string,
): SessionPreferencesRedisClient {
  return createClient({ url: redisUrl });
}

function buildSessionPreferenceRedisKey(
  sessionId: string,
  key: string,
): string {
  return `session:${sessionId}:pref:${key}`;
}

export async function getStoredSessionPreference(
  redisClient: SessionPreferencesRedisClient,
  sessionId: string,
  key: string,
): Promise<any | null> {
  const redisKey = buildSessionPreferenceRedisKey(sessionId, key);
  const serializedValue = await redisClient.get(redisKey);

  return serializedValue ? JSON.parse(serializedValue.toString()) : null;
}

export async function setStoredSessionPreference(
  redisClient: SessionPreferencesRedisClient,
  sessionId: string,
  key: string,
  value: any,
  ttlInSeconds?: number,
): Promise<void> {
  const redisKey = buildSessionPreferenceRedisKey(sessionId, key);
  const serializedValue = JSON.stringify(value);
  const sessionPreferenceTtlSeconds =
    ttlInSeconds ?? DEFAULT_SESSION_PREFERENCE_TTL_SECONDS;

  await redisClient.setEx(
    redisKey,
    sessionPreferenceTtlSeconds,
    serializedValue,
  );
}

export async function deleteStoredSessionPreference(
  redisClient: SessionPreferencesRedisClient,
  sessionId: string,
  key: string,
): Promise<void> {
  const redisKey = buildSessionPreferenceRedisKey(sessionId, key);
  await redisClient.del(redisKey);
}
