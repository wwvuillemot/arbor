import { describe, expect, it } from "vitest";

import { arrayBufferToBase64 } from "@/lib/base64";

describe("arrayBufferToBase64", () => {
  it("encodes small binary payloads", () => {
    const bytes = new Uint8Array([65, 114, 98, 111, 114]);

    expect(arrayBufferToBase64(bytes.buffer)).toBe("QXJib3I=");
  });

  it("encodes payloads larger than the chunk size", () => {
    const repeatedText = "a".repeat(9000);
    const encoder = new TextEncoder();
    const arrayBuffer = encoder.encode(repeatedText).buffer;

    expect(arrayBufferToBase64(arrayBuffer)).toBe(btoa(repeatedText));
  });

  it("returns an empty string for empty buffers", () => {
    expect(arrayBufferToBase64(new Uint8Array([]).buffer)).toBe("");
  });
});
