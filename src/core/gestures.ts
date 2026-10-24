import { cropSpan, zoomAbout } from "./crop";
import { selectedPhoto, type Editor } from "./editor";
import { CANVAS_HEIGHT, CANVAS_WIDTH, computeLayout } from "./layout";
import type { Crop, Point } from "./types";

// Safari's non-standard trackpad pinch event
type GestureEvent = Event & { scale: number; clientX: number; clientY: number };

const DOUBLE_TAP_MS = 300;
const DOUBLE_TAP_DISTANCE = 30;

function toCanvasPoint(
  el: HTMLCanvasElement,
  e: { clientX: number; clientY: number },
): Point {
  const rect = el.getBoundingClientRect();
  return {
    x: ((e.clientX - rect.left) * CANVAS_WIDTH) / rect.width,
    y: ((e.clientY - rect.top) * CANVAS_HEIGHT) / rect.height,
  };
}

// Pan and zoom the selected photo's crop with the mouse, touch and trackpad.
// Returns a function that removes the listeners.
export function attachGestures(el: HTMLCanvasElement, editor: Editor) {
  const pointers = new Map<number, Point>();
  let gesture: { crop: Crop; pointers: Map<number, Point> } | null = null;
  let lastTap: { time: number; x: number; y: number } | null = null;
  let safariGesture: Crop | null = null;

  // the selected photo, with where it's drawn and its crop window
  function current() {
    const state = editor.getSnapshot();
    const photo = selectedPhoto(state);
    if (!photo) return null;
    return {
      crop: photo.crop,
      span: cropSpan(photo.width, photo.height, photo.crop.shape),
      frame: computeLayout(photo, state.settings).frame,
    };
  }

  function onWheel(e: WheelEvent) {
    const c = current();
    if (!c) return;
    e.preventDefault();

    const { crop, span, frame } = c;
    const p = toCanvasPoint(el, e);
    const unit = e.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : 1;

    // trackpad pinch arrives as ctrl+wheel (except in Safari)
    if (e.ctrlKey) {
      if (safariGesture) return;
      const zoom = crop.zoom * Math.exp(-e.deltaY * unit * 0.01);
      editor.setCrop(zoomAbout(crop, span, frame, p, p, zoom));
    } else {
      const rect = el.getBoundingClientRect();
      const to = {
        x: p.x - (e.deltaX * unit * CANVAS_WIDTH) / rect.width,
        y: p.y - (e.deltaY * unit * CANVAS_HEIGHT) / rect.height,
      };
      editor.setCrop(zoomAbout(crop, span, frame, p, to, crop.zoom));
    }
  }

  function onGestureStart(e: Event) {
    e.preventDefault();
    // touch pinches are handled by the pointer events
    if (pointers.size === 0) safariGesture = current()?.crop ?? null;
  }

  function onGestureChange(e: Event) {
    e.preventDefault();
    const c = current();
    if (!safariGesture || !c) return;
    const ge = e as GestureEvent;
    const p = toCanvasPoint(el, ge);
    editor.setCrop(
      zoomAbout(
        safariGesture,
        c.span,
        c.frame,
        p,
        p,
        safariGesture.zoom * ge.scale,
      ),
    );
  }

  function onGestureEnd(e: Event) {
    e.preventDefault();
    safariGesture = null;
  }

  function restartGesture() {
    const crop = current()?.crop;
    gesture = crop ? { crop, pointers: new Map(pointers) } : null;
  }

  function onPointerDown(e: PointerEvent) {
    if (!current()) return;
    el.setPointerCapture(e.pointerId);

    // double tap / double click resets the crop
    if (pointers.size === 0) {
      if (
        lastTap &&
        e.timeStamp - lastTap.time < DOUBLE_TAP_MS &&
        Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) <
          DOUBLE_TAP_DISTANCE
      ) {
        editor.resetCrop();
        lastTap = null;
      } else {
        lastTap = { time: e.timeStamp, x: e.clientX, y: e.clientY };
      }
    }

    pointers.set(e.pointerId, toCanvasPoint(el, e));
    restartGesture();
  }

  function onPointerMove(e: PointerEvent) {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, toCanvasPoint(el, e));

    const g = gesture;
    const c = current();
    if (!g || !c) return;

    const { span, frame } = c;
    const ids = [...g.pointers.keys()].filter((id) => pointers.has(id));

    if (ids.length >= 2) {
      // pinch: zoom by the change in finger distance, anchored at the midpoint
      const [a0, b0] = [g.pointers.get(ids[0])!, g.pointers.get(ids[1])!];
      const [a1, b1] = [pointers.get(ids[0])!, pointers.get(ids[1])!];
      const d0 = Math.max(Math.hypot(b0.x - a0.x, b0.y - a0.y), 1);
      const d1 = Math.hypot(b1.x - a1.x, b1.y - a1.y);
      const mid0 = { x: (a0.x + b0.x) / 2, y: (a0.y + b0.y) / 2 };
      const mid1 = { x: (a1.x + b1.x) / 2, y: (a1.y + b1.y) / 2 };
      editor.setCrop(
        zoomAbout(g.crop, span, frame, mid0, mid1, (g.crop.zoom * d1) / d0),
      );
    } else if (ids.length === 1) {
      const from = g.pointers.get(ids[0])!;
      const to = pointers.get(ids[0])!;
      editor.setCrop(zoomAbout(g.crop, span, frame, from, to, g.crop.zoom));
    }
  }

  function onPointerUp(e: PointerEvent) {
    if (!pointers.delete(e.pointerId)) return;
    restartGesture();
  }

  const listeners: Array<[string, (e: never) => void, AddEventListenerOptions?]> =
    [
      ["wheel", onWheel, { passive: false }],
      ["gesturestart", onGestureStart],
      ["gesturechange", onGestureChange],
      ["gestureend", onGestureEnd],
      ["pointerdown", onPointerDown],
      ["pointermove", onPointerMove],
      ["pointerup", onPointerUp],
      ["pointercancel", onPointerUp],
    ];
  for (const [type, fn, options] of listeners) {
    el.addEventListener(type, fn as EventListener, options);
  }
  return () => {
    for (const [type, fn] of listeners) {
      el.removeEventListener(type, fn as EventListener);
    }
  };
}
