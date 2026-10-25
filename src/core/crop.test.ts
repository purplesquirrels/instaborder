import { describe, expect, it } from "vitest";
import {
  clampCrop,
  cropScale,
  cropWindow,
  DEFAULT_CROP,
  MAX_ZOOM,
  snapAngle,
  transformAbout,
} from "./crop";
import type { Crop, Point, Rect } from "./types";

const deg = (d: number) => (d * Math.PI) / 180;

describe("cropWindow", () => {
  it("shows the whole photo for the original shape", () => {
    expect(cropWindow(3000, 2000, DEFAULT_CROP)).toEqual({ x: 3000, y: 2000 });
  });

  it("trims the sides of a landscape photo for a portrait crop", () => {
    const win = cropWindow(3000, 2000, { shape: "portrait", angle: 0 });
    expect(win.y).toBe(2000);
    // 2:3 window out of a 3:2 image
    expect(win.x / 3000).toBeCloseTo(4 / 9);
  });

  it("trims the top and bottom of a portrait photo for a landscape crop", () => {
    const win = cropWindow(2000, 3000, { shape: "landscape", angle: 0 });
    expect(win.x).toBe(2000);
    expect(win.y / 3000).toBeCloseTo(4 / 9);
  });

  it("turns the original shape onto its side past 45°", () => {
    const win = cropWindow(3000, 2000, { shape: "original", angle: deg(90) });
    // the whole photo, now standing upright
    expect(win.x).toBeCloseTo(2000);
    expect(win.y).toBeCloseTo(3000);
    const at45 = cropWindow(3000, 2000, { shape: "original", angle: deg(45) });
    expect(at45.x / at45.y).toBeCloseTo(1.5);
  });

  it("shrinks to fit inside the photo when turned", () => {
    const win = cropWindow(3000, 2000, { shape: "original", angle: deg(10) });
    expect(win.x).toBeLessThan(3000);
    expect(win.x / win.y).toBeCloseTo(1.5);
  });
});

describe("clampCrop", () => {
  it("keeps the zoom between 1 and MAX_ZOOM", () => {
    expect(clampCrop({ ...DEFAULT_CROP, zoom: 0.2 }, 1000, 1000).zoom).toBe(1);
    expect(clampCrop({ ...DEFAULT_CROP, zoom: 99 }, 1000, 1000).zoom).toBe(
      MAX_ZOOM,
    );
  });

  it("centres the photo when it isn't zoomed", () => {
    const crop = clampCrop({ ...DEFAULT_CROP, cx: 0.9, cy: 0.1 }, 1000, 1000);
    expect(crop.cx).toBe(0.5);
    expect(crop.cy).toBe(0.5);
  });

  it("keeps the visible window inside the photo when zoomed", () => {
    const crop = clampCrop(
      { zoom: 2, cx: 0, cy: 1, shape: "original", angle: 0 },
      1000,
      1000,
    );
    // the window is half the photo, so its centre can't pass the quarters
    expect(crop.cx).toBe(0.25);
    expect(crop.cy).toBe(0.75);
  });

  it("keeps a turned window's corners inside the photo", () => {
    const [width, height] = [3000, 2000];
    for (const angle of [deg(10), deg(-30), deg(45), deg(100), deg(170)]) {
      const crop = clampCrop(
        { zoom: 1.5, cx: 0, cy: 1, shape: "original", angle },
        width,
        height,
      );
      const win = cropWindow(width, height, crop);
      const [c, s] = [Math.cos(angle), Math.sin(angle)];
      for (const [sx, sy] of [
        [-1, -1],
        [1, -1],
        [1, 1],
        [-1, 1],
      ]) {
        const dx = (sx * win.x) / (2 * crop.zoom);
        const dy = (sy * win.y) / (2 * crop.zoom);
        const u = crop.cx * width + c * dx - s * dy;
        const v = crop.cy * height + s * dx + c * dy;
        expect(u).toBeGreaterThanOrEqual(-1e-6);
        expect(u).toBeLessThanOrEqual(width + 1e-6);
        expect(v).toBeGreaterThanOrEqual(-1e-6);
        expect(v).toBeLessThanOrEqual(height + 1e-6);
      }
    }
  });

  it("keeps the angle in (-π, π]", () => {
    const crop = clampCrop({ ...DEFAULT_CROP, angle: deg(270) }, 1000, 1000);
    expect(crop.angle).toBeCloseTo(deg(-90));
  });
});

describe("transformAbout", () => {
  const photo = { width: 1000, height: 1000 };
  const frame: Rect = { x: 100, y: 200, w: 800, h: 800 };
  const frameOf = () => frame;

  // the image point (in pixels) under a canvas point
  function imagePoint(crop: Crop, p: Point): Point {
    const k = cropScale(photo, crop, frame);
    const dx = (p.x - frame.x - frame.w / 2) / k;
    const dy = (p.y - frame.y - frame.h / 2) / k;
    const [c, s] = [Math.cos(crop.angle), Math.sin(crop.angle)];
    return {
      x: crop.cx * photo.width + c * dx + s * dy,
      y: crop.cy * photo.height - s * dx + c * dy,
    };
  }

  it("keeps the anchor point under the cursor while zooming", () => {
    const p = { x: 300, y: 350 };
    const crop = transformAbout(DEFAULT_CROP, photo, frameOf, p, p, 3);
    expect(crop.zoom).toBe(3);
    const before = imagePoint(DEFAULT_CROP, p);
    const after = imagePoint(crop, p);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("moves the image point from `from` to `to` when panning", () => {
    const start: Crop = { ...DEFAULT_CROP, zoom: 2 };
    const from = { x: 500, y: 500 };
    const to = { x: 600, y: 450 };
    const crop = transformAbout(start, photo, frameOf, from, to, start.zoom);
    const before = imagePoint(start, from);
    const after = imagePoint(crop, to);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("keeps the point between the fingers under them while turning", () => {
    const start: Crop = { ...DEFAULT_CROP, zoom: 2, angle: deg(5) };
    const from = { x: 450, y: 650 };
    const to = { x: 480, y: 600 };
    const crop = transformAbout(start, photo, frameOf, from, to, 2.5, deg(30));
    expect(crop.angle).toBeCloseTo(deg(30));
    const before = imagePoint(start, from);
    const after = imagePoint(crop, to);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });
});

describe("snapAngle", () => {
  it("snaps to multiples of 45° when close", () => {
    expect(snapAngle(deg(2))).toEqual({ angle: 0, snapped: true });
    expect(snapAngle(deg(43)).angle).toBeCloseTo(deg(45));
    expect(snapAngle(deg(-88)).angle).toBeCloseTo(deg(-90));
    expect(snapAngle(deg(43)).snapped).toBe(true);
  });

  it("leaves other angles alone", () => {
    const snap = snapAngle(deg(20));
    expect(snap.snapped).toBe(false);
    expect(snap.angle).toBeCloseTo(deg(20));
  });

  it("wraps around a half turn", () => {
    expect(snapAngle(deg(-179)).angle).toBeCloseTo(Math.PI);
    expect(snapAngle(deg(358)).angle).toBeCloseTo(0);
    expect(snapAngle(deg(200)).angle).toBeCloseTo(deg(-160));
  });
});
