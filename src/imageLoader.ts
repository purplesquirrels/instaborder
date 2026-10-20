import {
  decodePhotoImage,
  loadPhotoData,
  type LoadedPhoto,
  type WorkerCancel,
  type WorkerRelease,
  type WorkerRequest,
  type WorkerResponse,
} from "./imageProcessing";
import { removeCopies } from "./photoStorage";

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
let nextKey = 0;
const pending = new Map<number, Pending>();

// close bitmaps from a result nobody is waiting for any more
function release(result: LoadedPhoto | ImageBitmap) {
  if (result instanceof ImageBitmap) {
    result.close();
  } else {
    result.thumb.close();
    result.image?.close();
    releaseCopies([result.source]);
  }
}

function settle(msg: WorkerResponse) {
  const p = pending.get(msg.id);
  if (!p) {
    if ("result" in msg) release(msg.result);
    return;
  }
  pending.delete(msg.id);
  if ("error" in msg) p.reject(new Error(msg.error));
  else p.resolve(msg.result);
}

function runLocally(id: number, req: Request) {
  const job =
    req.type === "load"
      ? loadPhotoData(req.file, req.withImage, req.key)
      : decodePhotoImage(req.file);
  job.then(
    (result) => settle({ id, result }),
    (err) => settle({ id, error: String(err) }),
  );
}

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL("./imageWorker.ts", import.meta.url), {
    type: "module",
  });
  worker.addEventListener("message", (e: MessageEvent<WorkerResponse>) =>
    settle(e.data),
  );
  // the worker failed to start: finish everything on the main thread instead
  worker.addEventListener("error", () => {
    useWorker = false;
    worker?.terminate();
    worker = null;
    for (const [id, p] of pending) runLocally(id, p.req);
  });
  return worker;
}

function run(req: Request, signal?: AbortSignal): Promise<unknown> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(signal.reason);
    const id = nextId++;
    pending.set(id, { req, resolve, reject });
    signal?.addEventListener(
      "abort",
      () => {
        if (!pending.delete(id)) return;
        if (worker) worker.postMessage({ type: "cancel", id } as WorkerCancel);
        reject(signal.reason);
      },
      { once: true },
    );
    if (useWorker) getWorker().postMessage({ ...req, id } as WorkerRequest);
    else runLocally(id, req);
  });
}

// Decode a photo and build its thumbnail; `withImage` also returns the
// working-resolution bitmap so the photo can be shown straight away.
export function loadPhoto(file: File, withImage: boolean) {
  const key = `photo-${nextKey++}`;
  return run({ type: "load", file, withImage, key }) as Promise<LoadedPhoto>;
}

// Delete the stored copies behind these sources once their photos are gone.
export function releaseCopies(sources: File[]) {
  const names = sources.map((f) => f.name);
  if (worker) worker.postMessage({ type: "release", names } as WorkerRelease);
  else void removeCopies(names);
}

// Aborting drops the request if it hasn't started, and releases its result
// if it has.
export function decodePhoto(file: File, signal?: AbortSignal) {
  return run({ type: "decode", file }, signal) as Promise<ImageBitmap>;
}
