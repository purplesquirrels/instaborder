import { CANVAS_HEIGHT, CANVAS_WIDTH } from "./layout";
import { renderFrame } from "./render";
import type { Photo, Settings } from "./types";

export function exportFilename(name: string) {
  return `${name.replace(".", "_")}_mat.jpeg`;
}

function downloadImage(blob: Blob, filename = "untitled.jpeg") {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // give the download time to start before releasing the blob
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

// Render the framed photo at full size and download it as a JPEG.
export function exportPhoto(photo: Photo, settings: Settings) {
  const canvas = Object.assign(document.createElement("canvas"), {
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  });
  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) return;
  renderFrame(ctx, photo, settings);
  canvas.toBlob(
    (blob) => blob && downloadImage(blob, exportFilename(photo.name)),
    "image/jpeg",
    1.0,
  );
}
