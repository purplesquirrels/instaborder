import { useEffect, useRef } from "react";
import { editor } from "../core";
import { attachGestures } from "../core/gestures";
import { ASPECT_RATIO, CANVAS_HEIGHT, CANVAS_WIDTH } from "../core/layout";
import { renderFrame, renderGuides } from "../core/render";
import type { Photo, Settings } from "../core/types";

export function EditorCanvas({
  photo,
  settings,
  snapGuide,
}: {
  photo: Photo | undefined;
  settings: Settings;
  snapGuide: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const el = canvas.current;
    const ctx = el?.getContext("2d", { alpha: false });
    if (!el || !ctx) return;
    renderFrame(ctx, photo, settings);
    if (snapGuide) {
      const pixel = CANVAS_WIDTH / el.clientWidth;
      renderGuides(ctx, photo, settings, pixel);
    }
  }, [photo, settings, snapGuide]);

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
