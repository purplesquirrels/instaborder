import * as ExifReader from "exifreader";

// working resolution cap; photos up to this size are kept at full resolution
export const MAX_PIXELS = 32_777_216;
// iOS refuses to create canvases above this many pixels, so downscaling past
// it can fail there; also the retry size when memory runs short
const SAFE_PIXELS = 16_777_216;
// long edge of the filmstrip thumbnail (100px at up to 3x DPR)
const THUMB_SIZE = 300;
// EXIF lives in the APP1 segment, which is capped at 64KB near the file start
const EXIF_BYTES = 128 * 1024;

export interface LoadedPhoto {
  width: number;
  height: number;
  exif: ExifReader.Tags | null;
  thumb: ImageBitmap;
  thumbBlob: Blob;
  image: ImageBitmap | null;
}

export type WorkerRequest =
  | { id: number; type: "load"; file: File; withImage: boolean }
  | { id: number; type: "decode"; file: File };

// stop a queued request whose result is no longer wanted
export type WorkerCancel = { id: number; type: "cancel" };

export type WorkerResponse =
  | { id: number; result: LoadedPhoto | ImageBitmap }
  | { id: number; error: string };

type AnyCanvas = OffscreenCanvas | HTMLCanvasElement;

function drawScaled(source: ImageBitmap, w: number, h: number): AnyCanvas {
  const canvas: AnyCanvas =
    typeof OffscreenCanvas !== "undefined"
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement("canvas"), {
          width: w,
          height: h,
        });
  const ctx = canvas.getContext("2d", { alpha: false }) as
    OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D | null;
  if (!ctx) throw new Error("Unable to create canvas");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, w, h);
  return canvas;
}

function canvasToBitmap(canvas: AnyCanvas): Promise<ImageBitmap> {
  return "transferToImageBitmap" in canvas
    ? Promise.resolve(canvas.transferToImageBitmap())
    : createImageBitmap(canvas);
}

function canvasToBlob(canvas: AnyCanvas, type: string, quality: number) {
  if ("convertToBlob" in canvas) return canvas.convertToBlob({ type, quality });
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Unable to encode"))),
      type,
      quality,
    ),
  );
}

async function readExif(file: File): Promise<ExifReader.Tags | null> {
  try {
    return ExifReader.load(await file.slice(0, EXIF_BYTES).arrayBuffer());
  } catch {
    // tags pointing past the slice; fall back to the whole file
    try {
      return ExifReader.load(await file.arrayBuffer());
    } catch {
      return null;
    }
  }
}

// downscale to the working resolution, reusing the bitmap if it already fits
async function scaleTo(
  full: ImageBitmap,
  maxPixels: number,
): Promise<ImageBitmap> {
  const pixels = full.width * full.height;
  if (pixels <= maxPixels) return full;
  const scale = Math.sqrt(maxPixels / pixels);
  return canvasToBitmap(
    drawScaled(
      full,
      Math.floor(full.width * scale),
      Math.floor(full.height * scale),
    ),
  );
}

async function toWorking(full: ImageBitmap): Promise<ImageBitmap> {
  try {
    return await scaleTo(full, MAX_PIXELS);
  } catch (err) {
    // a canvas over the iOS limit (or out of memory): retry smaller
    if (MAX_PIXELS <= SAFE_PIXELS) throw err;
    console.warn("Falling back to a smaller working image", err);
    return scaleTo(full, SAFE_PIXELS);
  }
}

function decodeFull(file: File) {
  // the decode happens off the main thread; EXIF rotation is applied as <img> would
  return createImageBitmap(file, { imageOrientation: "from-image" });
}

export async function decodePhotoImage(file: File): Promise<ImageBitmap> {
  const full = await decodeFull(file);
  const image = await toWorking(full);
  if (image !== full) full.close();
  return image;
}

export async function loadPhotoData(
  file: File,
  withImage: boolean,
): Promise<LoadedPhoto> {
  const [exif, full] = await Promise.all([readExif(file), decodeFull(file)]);
  let image: ImageBitmap | null = null;
  try {
    const { width, height } = full;
    const scale = Math.min(1, THUMB_SIZE / Math.max(width, height));
    const thumbCanvas = drawScaled(
      full,
      Math.max(1, Math.round(width * scale)),
      Math.max(1, Math.round(height * scale)),
    );
    // encode before transferring, which clears the canvas
    const thumbBlob = await canvasToBlob(thumbCanvas, "image/jpeg", 0.7);
    const thumb = await canvasToBitmap(thumbCanvas);
    if (withImage) image = await toWorking(full);
    return { width, height, exif, thumb, thumbBlob, image };
  } finally {
    if (image !== full) full.close();
  }
}
