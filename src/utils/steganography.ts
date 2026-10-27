// LSB (Least Significant Bit) Steganography Utility for Image Concealment

const MAGIC_PREFIX = "STEG:";

/**
 * Embeds secret text into the LSBs of an image file and returns a PNG Blob
 */
export async function embedTextInImage(
  imageFile: File | string,
  secretText: string
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    const objectUrl =
      typeof imageFile === "string" ? imageFile : URL.createObjectURL(imageFile);

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          reject(new Error("Could not get canvas context"));
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Encode secret payload
        const encoder = new TextEncoder();
        const payloadBytes = encoder.encode(secretText);
        const magicBytes = encoder.encode(MAGIC_PREFIX);

        const totalPayloadLength = payloadBytes.length;

        // Structure: MAGIC_BYTES (5 bytes = 40 bits) + LENGTH_HEADER (32 bits / 4 bytes) + PAYLOAD
        const totalBytes = magicBytes.length + 4 + totalPayloadLength;
        const fullBuffer = new Uint8Array(totalBytes);

        // Copy MAGIC
        fullBuffer.set(magicBytes, 0);

        // Copy 32-bit length header (Big Endian)
        fullBuffer[5] = (totalPayloadLength >> 24) & 0xff;
        fullBuffer[6] = (totalPayloadLength >> 16) & 0xff;
        fullBuffer[7] = (totalPayloadLength >> 8) & 0xff;
        fullBuffer[8] = totalPayloadLength & 0xff;

        // Copy Payload
        fullBuffer.set(payloadBytes, 9);

        // Check if image capacity is sufficient
        // Available bits = width * height * 3 (R, G, B per pixel)
        const totalAvailableBits = canvas.width * canvas.height * 3;
        const requiredBits = totalBytes * 8;

        if (requiredBits > totalAvailableBits) {
          reject(new Error("Image is too small to embed the secret payload"));
          return;
        }

        // Convert fullBuffer into a bit stream
        let bitIndex = 0;
        const totalBits = requiredBits;

        for (let i = 0; i < data.length && bitIndex < totalBits; i++) {
          // Skip Alpha channel (i % 4 === 3)
          if (i % 4 === 3) continue;

          const byteIdx = Math.floor(bitIndex / 8);
          const bitPos = 7 - (bitIndex % 8);
          const bit = (fullBuffer[byteIdx] >> bitPos) & 1;

          // Replace LSB
          data[i] = (data[i] & 0xfe) | bit;
          bitIndex++;
        }

        ctx.putImageData(imageData, 0, 0);

        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error("Failed to export canvas to PNG blob"));
          }
        }, "image/png");
      } catch (err) {
        reject(err);
      } finally {
        if (typeof imageFile !== "string") {
          URL.revokeObjectURL(objectUrl);
        }
      }
    };

    img.onerror = () => {
      reject(new Error("Failed to load cover image"));
    };

    img.src = objectUrl;
  });
}

/**
 * Extracts hidden secret text from the LSBs of an image URL or Blob
 */
export async function extractTextFromImage(
  imageSrc: string
): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";

    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Read first 72 bits (5 bytes MAGIC + 4 bytes LENGTH = 9 bytes = 72 bits)
        const headerBits: number[] = [];
        let bitCount = 0;

        for (let i = 0; i < data.length && bitCount < 72; i++) {
          if (i % 4 === 3) continue; // Skip Alpha
          headerBits.push(data[i] & 1);
          bitCount++;
        }

        if (headerBits.length < 72) {
          resolve(null);
          return;
        }

        // Reconstruct header bytes
        const headerBytes = new Uint8Array(9);
        for (let b = 0; b < 9; b++) {
          let byteVal = 0;
          for (let bit = 0; bit < 8; bit++) {
            byteVal = (byteVal << 1) | headerBits[b * 8 + bit];
          }
          headerBytes[b] = byteVal;
        }

        // Verify MAGIC prefix "STEG:"
        const decoder = new TextDecoder();
        const magic = decoder.decode(headerBytes.subarray(0, 5));

        if (magic !== MAGIC_PREFIX) {
          resolve(null);
          return;
        }

        // Parse 32-bit length header
        const payloadLength =
          (headerBytes[5] << 24) |
          (headerBytes[6] << 16) |
          (headerBytes[7] << 8) |
          headerBytes[8];

        if (payloadLength <= 0 || payloadLength > 50000) {
          resolve(null);
          return;
        }

        // Read payload bits
        const totalPayloadBits = payloadLength * 8;
        const fullRequiredBits = 72 + totalPayloadBits;

        const allBits: number[] = [];
        let currentBit = 0;

        for (let i = 0; i < data.length && currentBit < fullRequiredBits; i++) {
          if (i % 4 === 3) continue; // Skip Alpha
          if (currentBit >= 72) {
            allBits.push(data[i] & 1);
          }
          currentBit++;
        }

        if (allBits.length < totalPayloadBits) {
          resolve(null);
          return;
        }

        // Reconstruct payload bytes
        const payloadBytes = new Uint8Array(payloadLength);
        for (let b = 0; b < payloadLength; b++) {
          let byteVal = 0;
          for (let bit = 0; bit < 8; bit++) {
            byteVal = (byteVal << 1) | allBits[b * 8 + bit];
          }
          payloadBytes[b] = byteVal;
        }

        const secretText = decoder.decode(payloadBytes);
        resolve(secretText);
      } catch (err) {
        console.warn("Steganography extraction error:", err);
        resolve(null);
      }
    };

    img.onerror = () => {
      resolve(null);
    };

    img.src = imageSrc;
  });
}
