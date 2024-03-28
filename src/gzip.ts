import pako from "pako";

/**
 * Compresses data using pako and checks if the compression ratio exceeds 10:1.
 * @param data The data to be compressed. It should be a string.
 * @returns A promise that resolves with the compressed data as a Uint8Array.
 * Throws an error if the compression ratio exceeds 15:1.
 */

export const compressDataWithRatioCheck = (
  data: string | ArrayBuffer
): Promise<Uint8Array> => {
  return new Promise((resolve, reject) => {
    // Determine if the data is a string or binary and encode/process accordingly
    const buffer = data instanceof ArrayBuffer
      ? new Uint8Array(data) // For binary data, create a Uint8Array view
      : new TextEncoder().encode(data); // For string data, encode to Uint8Array

    const compressedData = pako.gzip(buffer);

    const uncompressedSize = buffer.byteLength;
    const compressedSize = compressedData.byteLength;

    const ratio = uncompressedSize / compressedSize;

    if (ratio > 10) {
      reject(new Error("Compression ratio exceeds 10:1. Reverting."));
    } else {
      resolve(compressedData);
    }
  });
};