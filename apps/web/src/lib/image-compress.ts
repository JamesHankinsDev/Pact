'use client';

/**
 * Downscale + JPEG-encode an image client-side before uploading. Phone
 * photos are routinely 5–8 MB, which blows past Vercel's ~4.5 MB
 * serverless body limit even though our app code allows 10 MB. After
 * this pass most photos land at 200–800 KB.
 *
 * Returns { base64, mediaType } shaped for our `/api/vision/*` routes.
 */
export type CompressedImage = {
  /** Raw base64 (no data URL prefix) — feed to /api/vision/* routes. */
  base64: string;
  /** Always JPEG after compression. */
  mediaType: 'image/jpeg';
  /** A Blob of the compressed JPEG, ready to upload to Firebase Storage. */
  blob: Blob;
};

const DEFAULT_MAX_DIMENSION = 1600;
const DEFAULT_QUALITY = 0.85;

export async function compressImageForUpload(
  file: File,
  opts: { maxDimension?: number; quality?: number } = {},
): Promise<CompressedImage> {
  const maxDim = opts.maxDimension ?? DEFAULT_MAX_DIMENSION;
  const quality = opts.quality ?? DEFAULT_QUALITY;

  const img = await loadImage(file);
  try {
    const { width, height } = img;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable');
    // White background so any transparency in PNGs becomes a sensible JPEG
    // background instead of black.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    const comma = dataUrl.indexOf(',');
    const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Canvas toBlob returned null'))),
        'image/jpeg',
        quality,
      );
    });
    return { base64, mediaType: 'image/jpeg', blob };
  } finally {
    if (img.src.startsWith('blob:')) URL.revokeObjectURL(img.src);
  }
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to read image'));
    };
    img.src = url;
  });
}
