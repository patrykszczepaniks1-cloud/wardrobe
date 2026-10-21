"use client";

/** Downscale a picked photo to a JPEG data URL so it fits comfortably in IndexedDB. */
export async function compressImage(file: File, maxSize = 1600, quality = 0.82): Promise<string> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  const source: CanvasImageSource & { width: number; height: number } =
    bitmap ?? (await loadImageElement(file));
  const scale = Math.min(1, maxSize / Math.max(source.width, source.height));
  const w = Math.round(source.width * scale);
  const h = Math.round(source.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  canvas.getContext("2d")!.drawImage(source, 0, 0, w, h);
  bitmap?.close();
  return canvas.toDataURL("image/jpeg", quality);
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
