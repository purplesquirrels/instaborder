import type { Crop, CropShape, Point, Rect } from "./types";

export const MAX_ZOOM = 5;
// how close to a multiple of 45° the angle snaps to it
export const SNAP_THRESHOLD = (4 * Math.PI) / 180;
const SNAP_STEP = Math.PI / 4;
export const DEFAULT_CROP: Crop = {
  zoom: 1,
  cx: 0.5,
  cy: 0.5,
  shape: "original",
  angle: 0,
};
export const NEXT_SHAPE: Record<CropShape, CropShape> = {
  original: "portrait",
  portrait: "landscape",
  landscape: "original",
};

export interface PhotoSize {
  width: number;
  height: number;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// the same angle, in (-π, π]
export function normaliseAngle(angle: number) {
  const a = angle % (2 * Math.PI);
  if (a <= -Math.PI) return a + 2 * Math.PI;
  if (a > Math.PI) return a - 2 * Math.PI;
  return a;
}

// whether the photo is turned more than 45° from upright or upside down,
// i.e. it's now on its side
function isSideways(angle: number) {
  const a = Math.abs(normaliseAngle(angle));
  const eps = 1e-9;
  return a > Math.PI / 4 + eps && a < (3 * Math.PI) / 4 - eps;
}

// aspect ratio (w/h) the photo is shown at for a given crop; cropped shapes
// use 3:2 to match 35mm film, and the original shape follows the photo onto
// its side
export function cropAspect(
  width: number,
  height: number,
  { shape, angle }: Pick<Crop, "shape" | "angle">,
) {
  if (shape === "portrait") return 2 / 3;
  if (shape === "landscape") return 3 / 2;
  return isSideways(angle) ? height / width : width / height;
}

// Size of the visible window at zoom 1, in image pixels: the largest window
// of the frame's shape that still fits inside the photo when turned by the
// crop's angle.
export function cropWindow(
  width: number,
  height: number,
  crop: Pick<Crop, "shape" | "angle">,
): Point {
  const aspect = cropAspect(width, height, crop);
  const c = Math.abs(Math.cos(crop.angle));
  const s = Math.abs(Math.sin(crop.angle));
  const w = Math.min(width / (c + s / aspect), height / (s + c / aspect));
  return { x: w, y: w / aspect };
}

// keep the zoom in range and the image covering the whole frame
export function clampCrop(crop: Crop, width: number, height: number): Crop {
  const zoom = clamp(crop.zoom, 1, MAX_ZOOM);
  const angle = normaliseAngle(crop.angle);
  const win = cropWindow(width, height, { shape: crop.shape, angle });
  const ww = win.x / zoom;
  const wh = win.y / zoom;
  const c = Math.abs(Math.cos(angle));
  const s = Math.abs(Math.sin(angle));
  // half the turned window's bounding box, in normalised image coords
  const hx = (ww * c + wh * s) / (2 * width);
  const hy = (ww * s + wh * c) / (2 * height);
  return {
    zoom,
    cx: clamp(crop.cx, hx, 1 - hx),
    cy: clamp(crop.cy, hy, 1 - hy),
    shape: crop.shape,
    angle,
  };
}

// canvas pixels per image pixel when `crop` fills `frame`
export function cropScale(photo: PhotoSize, crop: Crop, frame: Rect) {
  return (frame.w * crop.zoom) / cropWindow(photo.width, photo.height, crop).x;
}

// Zoom to `zoom` and turn to `angle`, moving the image point that was under
// `from` (in `crop`) so it ends up under `to`. All points are in canvas
// coords; `frameOf` gives where a crop is drawn, as turning can change the
// frame's shape.
export function transformAbout(
  crop: Crop,
  photo: PhotoSize,
  frameOf: (crop: Crop) => Rect,
  from: Point,
  to: Point,
  zoom: number,
  angle = crop.angle,
): Crop {
  const { width, height } = photo;

  // the image point under `from`, in image pixels
  const f0 = frameOf(crop);
  const k0 = cropScale(photo, crop, f0);
  const dx0 = (from.x - f0.x - f0.w / 2) / k0;
  const dy0 = (from.y - f0.y - f0.h / 2) / k0;
  const c0 = Math.cos(crop.angle);
  const s0 = Math.sin(crop.angle);
  const u = crop.cx * width + c0 * dx0 + s0 * dy0;
  const v = crop.cy * height - s0 * dx0 + c0 * dy0;

  // put it under `to` at the new zoom and angle
  const next = { ...crop, zoom: clamp(zoom, 1, MAX_ZOOM), angle };
  const f1 = frameOf(next);
  const k1 = cropScale(photo, next, f1);
  const dx1 = (to.x - f1.x - f1.w / 2) / k1;
  const dy1 = (to.y - f1.y - f1.h / 2) / k1;
  const c1 = Math.cos(angle);
  const s1 = Math.sin(angle);
  return {
    ...next,
    cx: (u - c1 * dx1 - s1 * dy1) / width,
    cy: (v + s1 * dx1 - c1 * dy1) / height,
  };
}

// snap to the nearest multiple of 45° when close to it
export function snapAngle(angle: number): { angle: number; snapped: boolean } {
  const a = normaliseAngle(angle);
  const target = Math.round(a / SNAP_STEP) * SNAP_STEP;
  return Math.abs(a - target) <= SNAP_THRESHOLD
    ? { angle: normaliseAngle(target), snapped: true }
    : { angle: a, snapped: false };
}
