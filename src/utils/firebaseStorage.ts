import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { app, storage } from "./firebaseConfig";

export { app, storage };

// Keep retry timeouts short so network/CORS errors fall back to Base64 immediately
try {
  storage.maxUploadRetryTime = 1500;
  storage.maxOperationRetryTime = 1500;
} catch {}

function dataUrlToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(",");
  const mimeMatch = (parts[0] || "").match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : "image/webp";
  const byteString = atob((parts[1] || "").trim());
  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  return new Blob([ab], { type: mime });
}

/**
 * Instant client-side WebP canvas image compressor.
 * Downscales images to max width/height of 1600px and converts via WebP 0.80 quality
 * (`canvas.toDataURL('image/webp', 0.80)`), reducing 5MB photos down to ~150KB in milliseconds.
 */
export async function compressImageFile(
  file: File,
  maxDimension = 1600,
  quality = 0.80
): Promise<{ blob: Blob; dataUrl: string; file: File }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Failed to read image file"));
      reader.onload = () => {
        const dataUrl = String(reader.result || "");
        try {
          const fallbackBlob = dataUrlToBlob(dataUrl);
          resolve({ blob: fallbackBlob, dataUrl, file });
        } catch (e) {
          reject(e);
        }
      };
      reader.readAsDataURL(file);
    };

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      try {
        let width = img.naturalWidth || img.width || 1600;
        let height = img.naturalHeight || img.height || 1080;

        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.max(1, Math.round((height * maxDimension) / width));
            width = maxDimension;
          } else {
            width = Math.max(1, Math.round((width * maxDimension) / height));
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d", { alpha: true });
        if (!ctx) {
          throw new Error("Canvas 2D context unavailable");
        }

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to WebP at 0.80 quality (with JPEG fallback for legacy browsers)
        let compressedDataUrl = "";
        try {
          compressedDataUrl = canvas.toDataURL("image/webp", quality);
          if (!compressedDataUrl.startsWith("data:image/webp")) {
            compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
          }
        } catch {
          compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        }

        const blob = dataUrlToBlob(compressedDataUrl);
        const baseName = (file.name || "image").replace(/\.[^.]+$/, "");
        const ext = blob.type === "image/webp" ? "webp" : "jpg";
        const compressedFile = new File([blob], `${baseName}.${ext}`, {
          type: blob.type || "image/webp",
          lastModified: Date.now(),
        });

        resolve({ blob, dataUrl: compressedDataUrl, file: compressedFile });
      } catch (err) {
        reject(err);
      }
    };

    img.src = objectUrl;
  });
}

/**
 * Validates whether a media URL string is a valid HTTP(S) download URL or Base64 Data URL.
 */
export function isValidMediaUrl(url: unknown): url is string {
  if (!url || typeof url !== "string") return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  return (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("data:image/") ||
    trimmed.startsWith("data:audio/") ||
    trimmed.startsWith("blob:") ||
    trimmed.startsWith("/")
  );
}

/**
 * Compresses incoming photos using instant WebP canvas conversion (1600px, 0.80)
 * and returns the compressed Data URL immediately.
 */
export async function uploadRoomMedia(file: File, roomCode: string): Promise<string> {
  const { dataUrl } = await compressImageFile(file, 1600, 0.80);
  return dataUrl;
}
