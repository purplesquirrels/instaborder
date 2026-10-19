import {
  decodePhotoImage,
  loadPhotoData,
  type WorkerCancel,
  type WorkerRequest,
  type WorkerResponse,
} from "./imageProcessing";

function post(msg: WorkerResponse, transfer: Transferable[] = []) {
  (self as unknown as Worker).postMessage(msg, transfer);
}

async function handle(req: WorkerRequest) {
  try {
    if (req.type === "load") {
      const result = await loadPhotoData(req.file, req.withImage);
      post(
        { id: req.id, result },
        result.image ? [result.thumb, result.image] : [result.thumb],
      );
    } else {
      const result = await decodePhotoImage(req.file);
      post({ id: req.id, result }, [result]);
    }
  } catch (err) {
    post({ id: req.id, error: String(err) });
  }
}

// One job at a time, so two full-size decodes are never in memory together.
const queue: WorkerRequest[] = [];
let busy = false;

async function pump() {
  if (busy) return;
  busy = true;
  while (queue.length > 0) await handle(queue.shift()!);
  busy = false;
}

self.addEventListener(
  "message",
  (e: MessageEvent<WorkerRequest | WorkerCancel>) => {
    const msg = e.data;
    if (msg.type === "cancel") {
      // already-running jobs still reply; the main thread releases the result
      const i = queue.findIndex((r) => r.id === msg.id);
      if (i >= 0) queue.splice(i, 1);
      return;
    }
    // the photo the user just picked goes ahead of background loading
    if (msg.type === "decode") queue.unshift(msg);
    else queue.push(msg);
    void pump();
  },
);
