import type * as ExifReader from "exifreader";
import { describe, expect, it } from "vitest";
import { DEFAULT_CROP } from "./crop";
import { DEFAULT_SETTINGS } from "./editor";
import {
  CANVAS_HEIGHT,
  CANVAS_MARGIN,
  CANVAS_WIDTH,
  computeLayout,
  formatExif,
  type LayoutPhoto,
} from "./layout";

const exif = {
  ExposureTime: { description: "1/250" },
  FNumber: { description: "f/2.8" },
  ISOSpeedRatings: { description: "200" },
  FocalLengthIn35mmFilm: { description: "35" },
} as unknown as ExifReader.Tags;

function photo(overrides: Partial<LayoutPhoto> = {}): LayoutPhoto {
  return {
    exif,
    caption: "Hello",
    crop: DEFAULT_CROP,
    width: 3000,
    height: 2000,
    ...overrides,
  };
}

describe("formatExif", () => {
  it("joins the shooting settings", () => {
    expect(formatExif(exif)).toBe("35mm | f/2.8 | ISO200 | 1/250s");
  });

  it("skips missing fields", () => {
    const partial = { FNumber: { description: "f/8" } } as ExifReader.Tags;
    expect(formatExif(partial)).toBe("f/8");
    expect(formatExif(null)).toBe("");
  });
});

describe("computeLayout", () => {
  it("fits a landscape photo to the width, centred vertically", () => {
    const { frame } = computeLayout(photo(), DEFAULT_SETTINGS);
    expect(frame.x).toBe(CANVAS_MARGIN);
    expect(frame.w).toBe(CANVAS_WIDTH - 2 * CANVAS_MARGIN);
    expect(frame.h).toBeCloseTo(frame.w / 1.5);
    expect(frame.y + frame.h / 2).toBeCloseTo(CANVAS_HEIGHT / 2);
  });

  it("fits a portrait photo to the height, centred horizontally", () => {
    const { frame } = computeLayout(
      photo({ width: 2000, height: 3000 }),
      DEFAULT_SETTINGS,
    );
    expect(frame.y).toBe(CANVAS_MARGIN);
    expect(frame.h).toBe(CANVAS_HEIGHT - 2 * CANVAS_MARGIN);
    expect(frame.x + frame.w / 2).toBeCloseTo(CANVAS_WIDTH / 2);
  });

  it("leaves room under the photo for each line of text", () => {
    const tall = photo({ width: 2000, height: 3000 });
    const bottom = (exif: boolean, caption: boolean) => {
      const { frame } = computeLayout(tall, {
        ...DEFAULT_SETTINGS,
        exif,
        caption,
      });
      return CANVAS_HEIGHT - frame.y - frame.h;
    };
    expect(bottom(false, false)).toBe(CANVAS_MARGIN);
    expect(bottom(true, false)).toBe(100);
    expect(bottom(false, true)).toBe(100);
    expect(bottom(true, true)).toBe(170);
  });

  it("only shows text that's enabled and not empty", () => {
    const on = { ...DEFAULT_SETTINGS, exif: true, caption: true };
    const both = computeLayout(photo(), on);
    expect(both.exif?.text).toBe("35mm | f/2.8 | ISO200 | 1/250s");
    expect(both.caption?.text).toBe("Hello");
    // the caption moves up to make room for the EXIF line
    expect(both.caption!.y).toBeLessThan(both.exif!.y);

    const empty = computeLayout(photo({ exif: null, caption: "  " }), on);
    expect(empty.exif).toBeNull();
    expect(empty.caption).toBeNull();
  });

  it("maps the crop to how the photo is drawn in the frame", () => {
    const { frame, view } = computeLayout(
      photo({ crop: { ...DEFAULT_CROP, zoom: 2, cx: 0.25, cy: 0.75 } }),
      DEFAULT_SETTINGS,
    );
    expect(view.cx).toBe(0.25);
    expect(view.cy).toBe(0.75);
    expect(view.angle).toBe(0);
    // half the photo's width fills the frame
    expect(view.scale).toBeCloseTo(frame.w / 1500);
  });

  it("turns the frame upright once the photo is past 45°", () => {
    const at = (degrees: number) =>
      computeLayout(
        photo({ crop: { ...DEFAULT_CROP, angle: (degrees * Math.PI) / 180 } }),
        DEFAULT_SETTINGS,
      ).frame;
    expect(at(45).w).toBeGreaterThan(at(45).h);
    expect(at(50).w).toBeLessThan(at(50).h);
    expect(at(90).w / at(90).h).toBeCloseTo(2 / 3);
    expect(at(180).w / at(180).h).toBeCloseTo(3 / 2);
  });
});
