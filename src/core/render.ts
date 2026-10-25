import {
  computeLayout,
  CORNER_RADIUS,
  CANVAS_WIDTH,
  type Layout,
  type LayoutPhoto,
} from "./layout";
import type { Photo, Rect, Settings } from "./types";

type Context2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

const TEXT_COLOUR = "#999";
const GUIDE_COLOUR = "rgb(135, 206, 250)";

// the cropped photo, drawn here first so the glow only blurs what's visible
let glowCanvas: OffscreenCanvas | null = null;

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

// Draw the visible part of the photo, turned and scaled to fill `frame`.
function drawPhoto(
  ctx: Context2D,
  src: ImageBitmap,
  photo: LayoutPhoto,
  view: Layout["view"],
  frame: Rect,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(frame.x, frame.y, frame.w, frame.h);
  ctx.clip();
  ctx.translate(frame.x + frame.w / 2, frame.y + frame.h / 2);
  ctx.rotate(view.angle);
  ctx.scale(view.scale, view.scale);
  // sized by the photo, so the thumbnail placeholder lines up too
  ctx.drawImage(
    src,
    -view.cx * photo.width,
    -view.cy * photo.height,
    photo.width,
    photo.height,
  );
  ctx.restore();
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

  const { frame, view, exif, caption } = computeLayout(photo, settings);
  const { x, y, w, h } = frame;
  // show the thumbnail scaled up until the full image is decoded
  const src = photo.image ?? photo.thumb;

  ctx.imageSmoothingQuality = "high";

  if (settings.glow) {
    const gw = Math.ceil(w);
    const gh = Math.ceil(h);
    glowCanvas ??= new OffscreenCanvas(gw, gh);
    if (glowCanvas.width !== gw || glowCanvas.height !== gh) {
      glowCanvas.width = gw;
      glowCanvas.height = gh;
    }
    const glow = glowCanvas.getContext("2d");
    if (glow) {
      glow.imageSmoothingQuality = "high";
      glow.clearRect(0, 0, gw, gh);
      drawPhoto(glow, src, photo, view, { x: 0, y: 0, w, h });
      ctx.filter = "blur(300px)";
      ctx.globalAlpha = 0.65;
      ctx.drawImage(glowCanvas, 0, 0, w, h, x, y, w, h);
      ctx.filter = "none";
      ctx.globalAlpha = 1;
    }
  }

  ctx.save();
  if (settings.rounded) {
    ctx.clip(roundedRect(x, y, w, h, CORNER_RADIUS));
  }
  drawPhoto(ctx, src, photo, view, frame);
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

// Draw guides along the photo's own axes, through the middle of the frame,
// and label the angle it's snapped to. Only shown while editing, never
// exported. `pixel` is the size of one CSS pixel in canvas coords.
export function renderGuides(
  ctx: Context2D,
  photo: Photo | undefined,
  settings: Settings,
  pixel: number,
) {
  if (!photo) return;
  const { frame, view } = computeLayout(photo, settings);
  const { x, y, w, h } = frame;
  const fx = x + w / 2;
  const fy = y + h / 2;
  const reach = Math.hypot(w, h) / 2;
  const c = Math.cos(view.angle);
  const s = Math.sin(view.angle);

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.strokeStyle = GUIDE_COLOUR;
  ctx.lineWidth = pixel;
  ctx.beginPath();
  // the photo's horizontal and vertical axes
  ctx.moveTo(fx - c * reach, fy - s * reach);
  ctx.lineTo(fx + c * reach, fy + s * reach);
  ctx.moveTo(fx + s * reach, fy - c * reach);
  ctx.lineTo(fx - s * reach, fy + c * reach);
  ctx.stroke();

  const degrees = Math.round((view.angle * 180) / Math.PI);
  const label = `${degrees === -180 ? 180 : degrees}°`;
  ctx.font = "bold 52px Courier New";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lw = ctx.measureText(label).width + 56;
  const lh = 80;
  const ly = y + 40;
  ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
  ctx.fill(roundedRect(fx - lw / 2, ly, lw, lh, lh / 2));
  ctx.fillStyle = GUIDE_COLOUR;
  ctx.fillText(label, fx, ly + lh / 2);
  ctx.restore();
}
