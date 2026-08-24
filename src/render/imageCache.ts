import type { BinaryFile } from "../types";

const images = new Map<string, HTMLImageElement>();
const pending = new Map<string, Promise<HTMLImageElement>>();

export const loadImage = (file: BinaryFile): Promise<HTMLImageElement> => {
  const existing = images.get(file.id);
  if (existing) return Promise.resolve(existing);
  const inflight = pending.get(file.id);
  if (inflight) return inflight;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      images.set(file.id, img);
      pending.delete(file.id);
      resolve(img);
    };
    img.onerror = () => {
      pending.delete(file.id);
      reject(new Error(`Failed to decode image ${file.id}`));
    };
    img.src = file.dataURL;
  });
  pending.set(file.id, promise);
  return promise;
};

/** Synchronous lookup for the render loop; null until the decode finishes. */
export const getImage = (fileId: string) => images.get(fileId) ?? null;

/** Warms the cache for every file in a scene and resolves once all are decoded. */
export const preloadFiles = (files: Record<string, BinaryFile>) =>
  Promise.all(Object.values(files).map((f) => loadImage(f).catch(() => null)));
