import type { LoadedPhoto } from "../image/imageProcessing";
import { clampCrop, cropSpan, DEFAULT_CROP, NEXT_SHAPE } from "./crop";
import { createStore } from "./store";
import type { Crop, EditorState, Photo, Settings } from "./types";

// What the editor needs from the outside world, injected so tests can fake it.
export interface EditorDeps {
  // decode and thumbnail a picked file; `withImage` also decodes the full image
  loadPhoto: (file: File, withImage: boolean) => Promise<LoadedPhoto>;
  // decode a stored copy at working resolution
  decodePhoto: (source: File, signal?: AbortSignal) => Promise<ImageBitmap>;
  // delete the stored copies behind these sources
  releaseCopies: (sources: File[]) => void;
  createObjectURL: (blob: Blob) => string;
  revokeObjectURL: (url: string) => void;
  // a photo couldn't be loaded
  onLoadError: (err: unknown) => void;
}

export type OpenMode = "append" | "replace";

// how many photos keep a decoded full image; the rest drop back to thumbnails
const DECODED_CACHE_SIZE = 1;

export const DEFAULT_SETTINGS: Settings = {
  exif: false,
  caption: false,
  bg: "black",
  rounded: true,
  glow: false,
};

export function selectedPhoto(state: EditorState): Photo | undefined {
  return state.photos[state.selectedIndex];
}

export function pendingCount(state: EditorState) {
  return state.loadstate[1] - state.loadstate[0];
}

export function createEditor(deps: EditorDeps) {
  const store = createStore<EditorState>({
    photos: [],
    loadstate: [0, 0],
    selectedIndex: 0,
    phase: "start",
    settings: DEFAULT_SETTINGS,
  });
  const { getSnapshot, setState, subscribe } = store;

  let nextPhotoId = 0;
  // bumped when the photo list is replaced, so stale loads are discarded
  let loadGeneration = 0;
  // most recently viewed photo ids, newest last
  let recentIds: number[] = [];

  function releasePhoto(f: Photo) {
    deps.revokeObjectURL(f.url);
    f.thumb.close();
    f.image?.close();
  }

  function touchPhoto(id: number) {
    recentIds = [...recentIds.filter((r) => r !== id), id].slice(
      -DECODED_CACHE_SIZE,
    );
    // free photos that dropped out now, before the next decode needs the memory
    const isStale = (f: Photo) => f.image && !recentIds.includes(f.id);
    if (!getSnapshot().photos.some(isStale)) return;
    setState((state) => ({
      ...state,
      photos: state.photos.map((f) => {
        if (!isStale(f)) return f;
        f.image?.close();
        return { ...f, image: null };
      }),
    }));
  }

  // store a decoded image, unless the photo is gone or no longer recent
  function setImage(id: number, image: ImageBitmap) {
    let used = false;
    setState((state) => ({
      ...state,
      photos: state.photos.map((f) => {
        if (f.id !== id || f.image || !recentIds.includes(id)) return f;
        used = true;
        return { ...f, image };
      }),
    }));
    if (!used) image.close();
  }

  // Decode the selected photo at working resolution whenever the selection
  // changes or it loses its image. Moving on cancels the request, so coming
  // back always starts a new decode instead of waiting on a discarded one.
  let decodeKey: string | null = null;
  let decodeController: AbortController | null = null;

  function syncDecode() {
    const photo = selectedPhoto(getSnapshot());
    const key = photo ? `${photo.id}:${!photo.image}` : null;
    if (key === decodeKey) return;
    // set before touchPhoto, whose state change calls back in here
    decodeKey = key;
    decodeController?.abort();
    decodeController = null;
    if (!photo) return;

    touchPhoto(photo.id);
    if (photo.image) return;

    const controller = new AbortController();
    decodeController = controller;
    deps
      .decodePhoto(photo.source, controller.signal)
      .then((image) => setImage(photo.id, image))
      .catch((err) => {
        if (!controller.signal.aborted) console.error(err);
      });
  }
  subscribe(syncDecode);

  function clearPhotos(total: number) {
    const { photos } = getSnapshot();
    photos.forEach(releasePhoto);
    deps.releaseCopies(photos.map((f) => f.source));
    recentIds = [];
    setState((state) => ({
      ...state,
      photos: [],
      loadstate: [0, total],
      selectedIndex: 0,
      phase: "loading",
    }));
  }

  // Decode and thumbnail a photo, then add it to the list.
  // Returns false if a newer photo list replaced this one while it loaded.
  async function readFile(
    file: File,
    withImage: boolean,
    generation: number,
  ): Promise<boolean> {
    let loaded: LoadedPhoto | undefined;
    try {
      loaded = await deps.loadPhoto(file, withImage);
    } catch (err) {
      console.error(err);
      if (generation === loadGeneration) deps.onLoadError(err);
    }

    if (generation !== loadGeneration) {
      loaded?.thumb.close();
      loaded?.image?.close();
      if (loaded) deps.releaseCopies([loaded.source]);
      return false;
    }

    const photo: Photo | null = loaded
      ? {
          id: nextPhotoId++,
          url: deps.createObjectURL(loaded.thumbBlob),
          name: file.name,
          source: loaded.source,
          exif: loaded.exif,
          caption: "",
          crop: DEFAULT_CROP,
          thumb: loaded.thumb,
          image: loaded.image,
          width: loaded.width,
          height: loaded.height,
        }
      : null;
    setState((state) => ({
      ...state,
      photos: photo ? [...state.photos, photo] : state.photos,
      loadstate: [state.loadstate[0] + 1, state.loadstate[1]],
    }));
    return true;
  }

  // Load picked files, replacing the current photos or adding to them.
  async function openPhotos(
    fileList: Iterable<File> | null,
    mode: OpenMode = "replace",
  ) {
    // copy, as the input's FileList can change while we load
    const files = [...(fileList ?? [])];
    if (files.length === 0) return;

    if (mode === "replace") {
      loadGeneration++;
      clearPhotos(files.length);
    } else {
      setState((state) => ({
        ...state,
        loadstate: [state.loadstate[0], state.loadstate[1] + files.length],
      }));
    }
    const generation = loadGeneration;

    // one at a time, so only one full-size decode is in memory
    for (let i = 0; i < files.length; i++) {
      const current = await readFile(
        files[i],
        mode === "replace" && i === 0,
        generation,
      );
      if (!current) return;
      // start editing as soon as the first photo is ready
      if (i === 0) setState((state) => ({ ...state, phase: "editing" }));
    }
  }

  function removePhoto(index: number) {
    const state = getSnapshot();
    const photo = state.photos[index];
    if (!photo) return;
    releasePhoto(photo);
    deps.releaseCopies([photo.source]);
    recentIds = recentIds.filter((r) => r !== photo.id);

    // stay at the same position, or step back if it was the last photo
    const remaining = state.photos.length - 1;
    const backToStart = remaining === 0 && pendingCount(state) === 0;
    setState((state) => ({
      ...state,
      photos: state.photos.filter((f) => f.id !== photo.id),
      selectedIndex: Math.min(index, Math.max(remaining - 1, 0)),
      phase: backToStart ? "start" : state.phase,
    }));
  }

  function select(index: number) {
    setState((state) => ({ ...state, selectedIndex: index }));
  }

  function updateSelected(fn: (photo: Photo) => Photo) {
    setState((state) => ({
      ...state,
      photos: state.photos.map((f, i) =>
        i === state.selectedIndex ? fn(f) : f,
      ),
    }));
  }

  function setCaption(caption: string) {
    updateSelected((f) => ({ ...f, caption }));
  }

  // set the selected photo's crop, kept in range
  function setCrop(crop: Crop) {
    updateSelected((f) => ({
      ...f,
      crop: clampCrop(crop, cropSpan(f.width, f.height, crop.shape)),
    }));
  }

  function cycleShape() {
    const crop = selectedPhoto(getSnapshot())?.crop;
    if (crop) setCrop({ ...crop, shape: NEXT_SHAPE[crop.shape] });
  }

  // back to the whole photo, keeping the crop shape
  function resetCrop() {
    const crop = selectedPhoto(getSnapshot())?.crop;
    if (crop) setCrop({ ...DEFAULT_CROP, shape: crop.shape });
  }

  function setSettings(settings: Partial<Settings>) {
    setState((state) => ({
      ...state,
      settings: { ...state.settings, ...settings },
    }));
  }

  return {
    getSnapshot,
    subscribe,
    openPhotos,
    removePhoto,
    select,
    setCaption,
    setCrop,
    cycleShape,
    resetCrop,
    setSettings,
  };
}

export type Editor = ReturnType<typeof createEditor>;
