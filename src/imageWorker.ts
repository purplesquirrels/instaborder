import {
  decodePhotoImage,
  loadPhotoData,
  type WorkerRequest,
  type WorkerResponse,
} from "./imageProcessing";

function post(msg: WorkerResponse, transfer: Transferable[] = []) {
  (self as unknown as Worker).postMessage(msg, transfer);
}

self.addEventListener("message", async (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    if (req.type === "load") {
      const result = await loadPhotoData(req.file, req.withImage);
      post(
        { id: req.id, result },
        result.image ? [result.thumb, result.image] : [result.thumb]
      );
    } else {
      const result = await decodePhotoImage(req.file);
      post({ id: req.id, result }, [result]);
    }
  } catch (err) {
    post({ id: req.id, error: String(err) });
  }
});
