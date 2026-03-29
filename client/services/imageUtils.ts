/**
 * Client-side image compression using canvas.
 * Resizes large images before sending to vision APIs to reduce latency and payload size.
 */

const MAX_DIMENSION = 1568;
const JPEG_QUALITY = 0.85;

export async function compressImage(
  dataUrl: string,
  maxDimension: number = MAX_DIMENSION,
  quality: number = JPEG_QUALITY
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const { width, height } = img;

      // Skip compression for small images
      if (width <= maxDimension && height <= maxDimension) {
        resolve(dataUrl);
        return;
      }

      const scale = Math.min(maxDimension / width, maxDimension / height);
      const newWidth = Math.round(width * scale);
      const newHeight = Math.round(height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = newWidth;
      canvas.height = newHeight;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(dataUrl);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, newWidth, newHeight);

      // Use JPEG for photos (smaller), keep PNG for images with transparency
      const isPng = dataUrl.startsWith('data:image/png');
      const outputType = isPng ? 'image/png' : 'image/jpeg';
      const compressed = canvas.toDataURL(outputType, isPng ? undefined : quality);

      // Only use compressed version if it's actually smaller
      if (compressed.length < dataUrl.length) {
        resolve(compressed);
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => reject(new Error('Failed to load image for compression'));
    img.src = dataUrl;
  });
}
