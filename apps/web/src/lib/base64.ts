const BASE64_CHUNK_SIZE = 8192;

export function arrayBufferToBase64(arrayBuffer: ArrayBuffer): string {
  const bytes = new Uint8Array(arrayBuffer);
  let binaryString = "";

  for (let index = 0; index < bytes.length; index += BASE64_CHUNK_SIZE) {
    binaryString += String.fromCharCode(
      ...bytes.subarray(index, index + BASE64_CHUNK_SIZE),
    );
  }

  return btoa(binaryString);
}

export function base64ToUint8Array(base64String: string): Uint8Array {
  const binaryString = atob(base64String);
  const bytes = new Uint8Array(binaryString.length);

  for (let index = 0; index < binaryString.length; index += 1) {
    bytes[index] = binaryString.charCodeAt(index);
  }

  return bytes;
}
