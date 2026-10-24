import { computeLayout, CORNER_RADIUS, CANVAS_WIDTH } from "./layout";
import type { Photo, Settings } from "./types";

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const TEXT_COLOUR = "#999";

function roundedRect(x: number, y: number, w: number, h: number, r: number) {
  const roundRect = new Path2D();
  roundRect.moveTo(x + r, y);
  roundRect.arcTo(x, y, x, y + h - r, r); // top-left
  roundRect.arcTo(x, y + h, x + w - r, y + h, r); // bottom-left
  roundRect.arcTo(x + w, y + h, x + w, y + h - r, r); // bottom-right
  roundRect.arcTo(x + w, y, x + w - r, y, r); // top-right
  roundRect.lineTo(x + r, y);
  return roundRect;
}

// Draw the framed photo, or clear the canvas if there's nothing to show.
export function renderFrame(
  ctx: Context2D,
  photo: Photo | undefined,
  settings: Settings,
) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  // nothing selected, e.g. the last photo was removed
  if (!photo) return;

  ctx.fillStyle = settings.bg;
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  const { frame, source, exif, caption } = computeLayout(photo, settings);
  const { x, y, w, h } = frame;
  // show the thumbnail scaled up until the full image is decoded
  const src = photo.image ?? photo.thumb;
  const sx = source.x * src.width;
  const sy = source.y * src.height;
  const sw = source.w * src.width;
  const sh = source.h * src.height;

  ctx.imageSmoothingQuality = "high";

  if (settings.glow) {
    ctx.filter = "blur(300px)";
    ctx.globalAlpha = 0.65;
    ctx.drawImage(src, sx, sy, sw, sh, x, y, w, h);
    ctx.filter = "none";
    ctx.globalAlpha = 1;
  }

  ctx.save();
  if (settings.rounded) {
    ctx.clip(roundedRect(x, y, w, h, CORNER_RADIUS));
  }
  ctx.drawImage(src, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();

  ctx.fillStyle = TEXT_COLOUR;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  if (exif) {
    ctx.font = "bold 42px Courier New";
    ctx.fillText(exif.text, CANVAS_WIDTH / 2, exif.y);
  }

  if (caption) {
    ctx.font = "42px Courier New";
    ctx.fillText(caption.text, CANVAS_WIDTH / 2, caption.y);
  }
}
