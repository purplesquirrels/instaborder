import { decodePhoto, loadPhoto, releaseCopies } from "../image/imageLoader";
import { createEditor } from "./editor";

// The app's editor, wired to the real image pipeline.
export const editor = createEditor({
  loadPhoto,
  decodePhoto,
  releaseCopies,
  createObjectURL: (blob) => URL.createObjectURL(blob),
  revokeObjectURL: (url) => URL.revokeObjectURL(url),
  onLoadError: () => alert("Unable to load image"),
});
