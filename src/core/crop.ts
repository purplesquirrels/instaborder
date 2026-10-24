import type { Crop, CropShape, Point, Rect } from "./types";

export const MAX_ZOOM = 5;
export const DEFAULT_CROP: Crop = {
  zoom: 1,
  cx: 0.5,
  cy: 0.5,
  shape: "original",
};
export const NEXT_SHAPE: Record<CropShape, CropShape> = {
  original: "portrait",
  portrait: "landscape",
  landscape: "original",
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// aspect ratio (w/h) the photo is shown at for a given crop shape;
// cropped shapes use 3:2 to match 35mm film
export function cropAspect(width: number, height: number, shape: CropShape) {
  if (shape === "portrait") return 2 / 3;
  if (shape === "landscape") return 3 / 2;
  return width / height;
}

// size of the visible window at zoom 1, in normalised image coords (0-1)
export function cropSpan(width: number, height: number, shape: CropShape): Point {
  const imageAspect = width / height;
  const aspect = cropAspect(width, height, shape);
  return aspect < imageAspect
    ? { x: aspect / imageAspect, y: 1 }
    : { x: 1, y: imageAspect / aspect };
}

// keep the zoom in range and the image covering the whole frame
export function clampCrop({ zoom, cx, cy, shape }: Crop, span: Point): Crop {
  const z = clamp(zoom, 1, MAX_ZOOM);
  const hx = span.x / (2 * z);
  const hy = span.y / (2 * z);
  return {
    zoom: z,
    cx: clamp(cx, hx, 1 - hx),
    cy: clamp(cy, hy, 1 - hy),
    shape,
  };
}

// Zoom to `zoom`, moving the image point that was under `from` (in `crop`)
// so it ends up under `to`. All points are in canvas coords.
export function zoomAbout(
  crop: Crop,
  span: Point,
  frame: Rect,
  from: Point,
  to: Point,
  zoom: number,
): Crop {
  const z = clamp(zoom, 1, MAX_ZOOM);
  const fx = frame.x + frame.w / 2;
  const fy = frame.y + frame.h / 2;
  const u = crop.cx + ((from.x - fx) * span.x) / (frame.w * crop.zoom);
  const v = crop.cy + ((from.y - fy) * span.y) / (frame.h * crop.zoom);
  return {
    zoom: z,
    cx: u - ((to.x - fx) * span.x) / (frame.w * z),
    cy: v - ((to.y - fy) * span.y) / (frame.h * z),
    shape: crop.shape,
  };
}
