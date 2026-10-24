import { useEffect, useRef } from "react";
import { editor } from "../core";
import { attachGestures } from "../core/gestures";
import { ASPECT_RATIO, CANVAS_HEIGHT, CANVAS_WIDTH } from "../core/layout";
import { renderFrame } from "../core/render";
import type { Photo, Settings } from "../core/types";

export function EditorCanvas({
  photo,
  settings,
}: {
  photo: Photo | undefined;
  settings: Settings;
}) {
  const canvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d", { alpha: false });
    if (ctx) renderFrame(ctx, photo, settings);
  }, [photo, settings]);

  useEffect(() => {
    if (canvas.current) return attachGestures(canvas.current, editor);
  }, []);

  return (
    <canvas
      ref={canvas}
      width={CANVAS_WIDTH}
      height={CANVAS_HEIGHT}
      style={{ aspectRatio: ASPECT_RATIO }}
    ></canvas>
  );
}
