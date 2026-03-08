const DEFAULT_API_URL = "http://api.arbor.local";

function normalizeApiBaseUrl(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/+$/, "").replace(/\/api$/, "");
}

export function getMediaAttachmentUrl(attachmentId: string): string {
  const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL;
  const normalizedApiBaseUrl = normalizeApiBaseUrl(configuredApiUrl);
  return `${normalizedApiBaseUrl}/media/${attachmentId}`;
}
