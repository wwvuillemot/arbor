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
