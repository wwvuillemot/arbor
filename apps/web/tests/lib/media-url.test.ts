import { afterEach, describe, expect, it } from "vitest";
import { getMediaAttachmentUrl } from "@/lib/media-url";

describe("getMediaAttachmentUrl", () => {
  const originalApiUrl = process.env.NEXT_PUBLIC_API_URL;

  afterEach(() => {
    if (originalApiUrl === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
      return;
    }

    process.env.NEXT_PUBLIC_API_URL = originalApiUrl;
  });

  it("uses the default API origin when no env var is set", () => {
    delete process.env.NEXT_PUBLIC_API_URL;

    expect(getMediaAttachmentUrl("attachment-1")).toBe(
      "http://api.arbor.local/media/attachment-1",
    );
  });

  it("removes a trailing slash from the configured API origin", () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001/";

    expect(getMediaAttachmentUrl("attachment-2")).toBe(
      "http://localhost:3001/media/attachment-2",
    );
  });

  it("normalizes a configured /api suffix before building the media URL", () => {
    process.env.NEXT_PUBLIC_API_URL = "http://localhost:3001/api";

    expect(getMediaAttachmentUrl("attachment-3")).toBe(
      "http://localhost:3001/media/attachment-3",
    );
  });
});
