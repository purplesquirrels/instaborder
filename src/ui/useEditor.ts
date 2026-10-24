import { useSyncExternalStore } from "react";
import { editor } from "../core";

// The editor's current state; re-renders whenever it changes.
export function useEditor() {
  return useSyncExternalStore(editor.subscribe, editor.getSnapshot);
}
