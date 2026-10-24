import type * as ExifReader from "exifreader";
import { cropAspect, cropSpan } from "./crop";
import type { Photo, Rect, Settings } from "./types";

export const ASPECT_RATIO = 4 / 5;
export const CANVAS_WIDTH = 1440;
export const CANVAS_HEIGHT = 1440 / ASPECT_RATIO;
export const CANVAS_MARGIN = 25;
export const CORNER_RADIUS = 20;
// bottom margin with one or both lines of text under the photo
const TEXT_MARGIN = 100;
const TWO_LINE_MARGIN = 170;
// baselines of the text lines, up from the bottom edge
const TEXT_BOTTOM = 48;
const SECOND_LINE_BOTTOM = 118;

export interface Layout {
  // where the photo is drawn, in canvas coords
  frame: Rect;
  // the visible part of the photo, in normalised image coords (0-1)
  source: Rect;
  // EXIF line and its baseline, if shown
  exif: { text: string; y: number } | null;
  // caption line and its baseline, if shown
  caption: { text: string; y: number } | null;
}

export type LayoutPhoto = Pick<
  Photo,
  "exif" | "caption" | "crop" | "width" | "height"
>;

export function formatExif(exif: ExifReader.Tags | null): string {
  const exposure = exif?.["ExposureTime"]?.description;
  const ap = exif?.["FNumber"]?.description;
  const iso = exif?.["ISOSpeedRatings"]?.description;
  const focal = exif?.["FocalLengthIn35mmFilm"]?.description;

  return [
    focal ? focal + "mm" : false,
    ap,
    iso ? "ISO" + iso : false,
    exposure ? exposure + "s" : false,
  ]
    .filter(Boolean)
    .join(" | ");
}

export function computeLayout(photo: LayoutPhoto, settings: Settings): Layout {
  const meta = formatExif(photo.exif);
  const caption = photo.caption.trim();
  const showCaption = settings.caption && caption !== "";
  const showExif = settings.exif && meta !== "";

  const marginL = CANVAS_MARGIN;
  const marginR = CANVAS_MARGIN;
  const marginT = CANVAS_MARGIN;
  const marginB =
    showCaption && showExif
      ? TWO_LINE_MARGIN
      : showCaption || showExif
        ? TEXT_MARGIN
        : CANVAS_MARGIN;

  const { width, height, crop } = photo;
  const aspect = cropAspect(width, height, crop.shape);

  // calculate width and height if landscape
  let w = CANVAS_WIDTH - marginL - marginR;
  let h = w / aspect;

  // size if portrait
  if (h > CANVAS_HEIGHT - marginT - marginB) {
    h = CANVAS_HEIGHT - marginT - marginB;
    w = h * aspect;
  }

  let x = marginL;
  let y = CANVAS_HEIGHT * 0.5 - h * 0.5;

  // position if portrait
  if (h === CANVAS_HEIGHT - marginT - marginB) {
    x = CANVAS_WIDTH * 0.5 - w * 0.5;
    y = marginT;
  }

  const span = cropSpan(width, height, crop.shape);
  const sw = span.x / crop.zoom;
  const sh = span.y / crop.zoom;

  return {
    frame: { x, y, w, h },
    source: { x: crop.cx - sw / 2, y: crop.cy - sh / 2, w: sw, h: sh },
    exif: showExif ? { text: meta, y: CANVAS_HEIGHT - TEXT_BOTTOM } : null,
    caption: showCaption
      ? {
          text: caption,
          y: CANVAS_HEIGHT - (showExif ? SECOND_LINE_BOTTOM : TEXT_BOTTOM),
        }
      : null,
  };
}
