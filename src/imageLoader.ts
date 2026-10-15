import {
  decodePhotoImage,
  loadPhotoData,
  type LoadedPhoto,
  type WorkerRequest,
  type WorkerResponse,
} from "./imageProcessing";

// WorkerRequest without its id, keeping the union members apart
type Request = WorkerRequest extends infer R
  ? R extends unknown
    ? Omit<R, "id">
    : never
  : never;

interface Pending {
  req: Request;
  resolve: (result: unknown) => void;
  reject: (err: unknown) => void;
}

// Older browsers without OffscreenCanvas (or module workers) do the same work
// on the main thread; createImageBitmap still decodes asynchronously there.
let useWorker =
  typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined";
let worker: Worker | null = null;
let nextId = 0;
const pending = new Map<number, Pending>();

function runLocally(req: Request): Promise<unknown> {
  return req.type === "load"
    ? loadPhotoData(req.file, req.withImage)
    : decodePhotoImage(req.file);
}

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./imageWorker.ts", import.meta.url), {
    type: "module",
  });
  worker.addEventListener("message", (e: MessageEvent<WorkerResponse>) => {
    const p = pending.get(e.data.id);
    if (!p) return;
    pending.delete(e.data.id);
    if ("error" in e.data) p.reject(new Error(e.data.error));
    else p.resolve(e.data.result);
  });
  // the worker failed to start: finish everything on the main thread instead
  worker.addEventListener("error", () => {
    useWorker = false;
    worker?.terminate();
    worker = null;
    for (const p of pending.values()) runLocally(p.req).then(p.resolve, p.reject);
    pending.clear();
  });
  return worker;
}

function run(req: Request): Promise<unknown> {
  if (!useWorker) return runLocally(req);
  return new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, { req, resolve, reject });
    getWorker().postMessage({ ...req, id } as WorkerRequest);
  });
}

// Decode a photo and build its thumbnail; `withImage` also returns the
// working-resolution bitmap so the photo can be shown straight away.
export function loadPhoto(file: File, withImage: boolean) {
  return run({ type: "load", file, withImage }) as Promise<LoadedPhoto>;
}

export function decodePhoto(file: File) {
  return run({ type: "decode", file }) as Promise<ImageBitmap>;
}
