import { describe, expect, it } from "vitest";
import { clampCrop, cropSpan, DEFAULT_CROP, MAX_ZOOM, zoomAbout } from "./crop";
import type { Crop, Point, Rect } from "./types";

describe("cropSpan", () => {
  it("shows the whole photo for the original shape", () => {
    expect(cropSpan(3000, 2000, "original")).toEqual({ x: 1, y: 1 });
  });

  it("trims the sides of a landscape photo for a portrait crop", () => {
    const span = cropSpan(3000, 2000, "portrait");
    expect(span.y).toBe(1);
    // 2:3 window out of a 3:2 image
    expect(span.x).toBeCloseTo(4 / 9);
  });

  it("trims the top and bottom of a portrait photo for a landscape crop", () => {
    const span = cropSpan(2000, 3000, "landscape");
    expect(span.x).toBe(1);
    expect(span.y).toBeCloseTo(4 / 9);
  });
});

describe("clampCrop", () => {
  const span: Point = { x: 1, y: 1 };

  it("keeps the zoom between 1 and MAX_ZOOM", () => {
    expect(clampCrop({ ...DEFAULT_CROP, zoom: 0.2 }, span).zoom).toBe(1);
    expect(clampCrop({ ...DEFAULT_CROP, zoom: 99 }, span).zoom).toBe(MAX_ZOOM);
  });

  it("centres the photo when it isn't zoomed", () => {
    const crop = clampCrop({ ...DEFAULT_CROP, cx: 0.9, cy: 0.1 }, span);
    expect(crop.cx).toBe(0.5);
    expect(crop.cy).toBe(0.5);
  });

  it("keeps the visible window inside the photo when zoomed", () => {
    const crop = clampCrop({ zoom: 2, cx: 0, cy: 1, shape: "original" }, span);
    // the window is half the photo, so its centre can't pass the quarters
    expect(crop.cx).toBe(0.25);
    expect(crop.cy).toBe(0.75);
  });
});

describe("zoomAbout", () => {
  const span: Point = { x: 1, y: 1 };
  const frame: Rect = { x: 100, y: 200, w: 800, h: 600 };

  // the image point (0-1) under a canvas point
  function imagePoint(crop: Crop, p: Point): Point {
    const fx = frame.x + frame.w / 2;
    const fy = frame.y + frame.h / 2;
    return {
      x: crop.cx + ((p.x - fx) * span.x) / (frame.w * crop.zoom),
      y: crop.cy + ((p.y - fy) * span.y) / (frame.h * crop.zoom),
    };
  }

  it("keeps the anchor point under the cursor while zooming", () => {
    const p = { x: 300, y: 350 };
    const crop = zoomAbout(DEFAULT_CROP, span, frame, p, p, 3);
    expect(crop.zoom).toBe(3);
    const before = imagePoint(DEFAULT_CROP, p);
    const after = imagePoint(crop, p);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });

  it("moves the image point from `from` to `to` when panning", () => {
    const start: Crop = { zoom: 2, cx: 0.5, cy: 0.5, shape: "original" };
    const from = { x: 500, y: 500 };
    const to = { x: 600, y: 450 };
    const crop = zoomAbout(start, span, frame, from, to, start.zoom);
    const before = imagePoint(start, from);
    const after = imagePoint(crop, to);
    expect(after.x).toBeCloseTo(before.x);
    expect(after.y).toBeCloseTo(before.y);
  });
});
