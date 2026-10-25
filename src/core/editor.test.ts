import { describe, expect, it, vi, type Mock } from "vitest";
import type { LoadedPhoto } from "../image/imageProcessing";
import { createEditor, type EditorDeps } from "./editor";

type FakeBitmap = ImageBitmap & { close: Mock };

function bitmap(): FakeBitmap {
  return { width: 300, height: 200, close: vi.fn() } as unknown as FakeBitmap;
}

interface Deferred<T, A> {
  args: A;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
}

function setup() {
  const loads: Deferred<LoadedPhoto, { file: File; withImage: boolean }>[] = [];
  const decodes: Deferred<
    ImageBitmap,
    { source: File; signal?: AbortSignal }
  >[] = [];
  const deps = {
    loadPhoto: vi.fn(
      (file: File, withImage: boolean) =>
        new Promise<LoadedPhoto>((resolve, reject) =>
          loads.push({ args: { file, withImage }, resolve, reject }),
        ),
    ),
    decodePhoto: vi.fn(
      (source: File, signal?: AbortSignal) =>
        new Promise<ImageBitmap>((resolve, reject) =>
          decodes.push({ args: { source, signal }, resolve, reject }),
        ),
    ),
    releaseCopies: vi.fn(),
    createObjectURL: vi.fn(() => "blob:thumb"),
    revokeObjectURL: vi.fn(),
    onLoadError: vi.fn(),
  } satisfies EditorDeps;
  const editor = createEditor(deps);

  // finish the nth load, as the image loader would
  async function finishLoad(n: number) {
    const { file, withImage } = loads[n].args;
    const result: LoadedPhoto = {
      width: 3000,
      height: 2000,
      exif: null,
      thumb: bitmap(),
      thumbBlob: new Blob(),
      image: withImage ? bitmap() : null,
      source: new File([], `copy-of-${file.name}`),
    };
    loads[n].resolve(result);
    await flush();
    return result;
  }

  return { editor, deps, loads, decodes, finishLoad };
}

const flush = () => new Promise((r) => setTimeout(r, 0));
const file = (name: string) => new File([], name);

describe("openPhotos", () => {
  it("replaces the photos, decoding only the first in full", async () => {
    const { editor, loads, finishLoad, deps } = setup();
    void editor.openPhotos([file("a.jpg"), file("b.jpg")], "replace");
    expect(editor.getSnapshot().phase).toBe("loading");
    expect(editor.getSnapshot().loadstate).toEqual([0, 2]);

    await finishLoad(0);
    expect(loads[0].args.withImage).toBe(true);
    expect(editor.getSnapshot().phase).toBe("editing");
    expect(editor.getSnapshot().photos.map((p) => p.name)).toEqual(["a.jpg"]);

    await finishLoad(1);
    expect(loads[1].args.withImage).toBe(false);
    expect(editor.getSnapshot().loadstate).toEqual([2, 2]);
    expect(editor.getSnapshot().photos).toHaveLength(2);
    // the selected first photo already has its image
    expect(deps.decodePhoto).not.toHaveBeenCalled();
  });

  it("appends photos to the current list", async () => {
    const { editor, finishLoad } = setup();
    void editor.openPhotos([file("a.jpg")], "replace");
    await finishLoad(0);

    void editor.openPhotos([file("b.jpg"), file("c.jpg")], "append");
    expect(editor.getSnapshot().loadstate).toEqual([1, 3]);
    await finishLoad(1);
    await finishLoad(2);
    expect(editor.getSnapshot().photos.map((p) => p.name)).toEqual([
      "a.jpg",
      "b.jpg",
      "c.jpg",
    ]);
  });

  it("discards loads from a list that has since been replaced", async () => {
    const { editor, finishLoad, deps } = setup();
    void editor.openPhotos([file("a.jpg"), file("b.jpg")], "replace");
    const a = await finishLoad(0);

    void editor.openPhotos([file("c.jpg")], "replace");
    // the old photos are freed
    expect(a.thumb.close).toHaveBeenCalled();
    expect(a.image!.close).toHaveBeenCalled();
    expect(deps.releaseCopies).toHaveBeenCalledWith([a.source]);

    // b finishes after the replace, so it's thrown away
    const b = await finishLoad(1);
    expect(b.thumb.close).toHaveBeenCalled();
    expect(deps.releaseCopies).toHaveBeenCalledWith([b.source]);

    await finishLoad(2);
    expect(editor.getSnapshot().photos.map((p) => p.name)).toEqual(["c.jpg"]);
    expect(editor.getSnapshot().loadstate).toEqual([1, 1]);
  });

  it("reports photos that fail to load and carries on", async () => {
    const { editor, loads, finishLoad, deps } = setup();
    void editor.openPhotos([file("a.jpg"), file("b.jpg")], "replace");
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    loads[0].reject(new Error("bad jpeg"));
    await flush();
    expect(deps.onLoadError).toHaveBeenCalled();
    consoleError.mockRestore();

    await finishLoad(1);
    expect(editor.getSnapshot().photos.map((p) => p.name)).toEqual(["b.jpg"]);
    expect(editor.getSnapshot().loadstate).toEqual([2, 2]);
  });
});

describe("removePhoto", () => {
  async function withTwoPhotos() {
    const ctx = setup();
    void ctx.editor.openPhotos([file("a.jpg"), file("b.jpg")], "replace");
    await ctx.finishLoad(0);
    await ctx.finishLoad(1);
    return ctx;
  }

  it("steps back when the last photo is removed", async () => {
    const { editor } = await withTwoPhotos();
    editor.select(1);
    editor.removePhoto(1);
    expect(editor.getSnapshot().selectedIndex).toBe(0);
    expect(editor.getSnapshot().photos.map((p) => p.name)).toEqual(["a.jpg"]);
  });

  it("frees the photo's resources", async () => {
    const { editor, deps } = await withTwoPhotos();
    const photo = editor.getSnapshot().photos[0];
    editor.removePhoto(0);
    expect(photo.thumb.close).toHaveBeenCalled();
    expect(deps.revokeObjectURL).toHaveBeenCalledWith(photo.url);
    expect(deps.releaseCopies).toHaveBeenCalledWith([photo.source]);
  });

  it("returns to the start screen once every photo is gone", async () => {
    const { editor } = await withTwoPhotos();
    editor.removePhoto(0);
    expect(editor.getSnapshot().phase).toBe("editing");
    editor.removePhoto(0);
    expect(editor.getSnapshot().phase).toBe("start");
  });

  it("stays on the editor while more photos are loading", async () => {
    const { editor, finishLoad } = setup();
    void editor.openPhotos([file("a.jpg"), file("b.jpg")], "replace");
    await finishLoad(0);
    editor.removePhoto(0);
    expect(editor.getSnapshot().phase).toBe("editing");
  });
});

describe("decoding the selected photo", () => {
  async function withTwoPhotos() {
    const ctx = setup();
    void ctx.editor.openPhotos([file("a.jpg"), file("b.jpg")], "replace");
    await ctx.finishLoad(0);
    await ctx.finishLoad(1);
    return ctx;
  }

  it("decodes a photo when it's selected and frees the previous one", async () => {
    const { editor, decodes } = await withTwoPhotos();
    const [a, b] = editor.getSnapshot().photos;

    editor.select(1);
    expect(decodes).toHaveLength(1);
    expect(decodes[0].args.source).toBe(b.source);
    // only one photo keeps its full image
    expect(a.image!.close).toHaveBeenCalled();
    expect(editor.getSnapshot().photos[0].image).toBeNull();

    const image = bitmap();
    decodes[0].resolve(image);
    await flush();
    expect(editor.getSnapshot().photos[1].image).toBe(image);

    editor.select(0);
    expect(image.close).toHaveBeenCalled();
    expect(decodes).toHaveLength(2);
    expect(decodes[1].args.source).toBe(a.source);
  });

  it("cancels the decode when the selection moves on", async () => {
    const { editor, decodes } = await withTwoPhotos();
    editor.select(1);
    const { signal } = decodes[0].args;
    expect(signal?.aborted).toBe(false);

    editor.select(0);
    expect(signal?.aborted).toBe(true);

    // a result that arrives anyway isn't kept
    const late = bitmap();
    decodes[0].resolve(late);
    await flush();
    expect(late.close).toHaveBeenCalled();
    expect(editor.getSnapshot().photos[1].image).toBeNull();
  });
});

describe("editing", () => {
  it("clamps crops and keeps the shape when resetting", async () => {
    const { editor, finishLoad } = setup();
    void editor.openPhotos([file("a.jpg")], "replace");
    await finishLoad(0);

    editor.setCrop({ zoom: 50, cx: 2, cy: -1, shape: "original", angle: 0 });
    expect(editor.getSnapshot().photos[0].crop).toEqual({
      zoom: 5,
      cx: 0.9,
      cy: 0.1,
      shape: "original",
      angle: 0,
    });

    editor.cycleShape();
    expect(editor.getSnapshot().photos[0].crop.shape).toBe("portrait");

    editor.resetCrop();
    expect(editor.getSnapshot().photos[0].crop).toEqual({
      zoom: 1,
      cx: 0.5,
      cy: 0.5,
      shape: "portrait",
      angle: 0,
    });
  });

  it("captions the selected photo", async () => {
    const { editor, finishLoad } = setup();
    void editor.openPhotos([file("a.jpg"), file("b.jpg")], "replace");
    await finishLoad(0);
    await finishLoad(1);
    editor.select(1);
    editor.setCaption("Hello");
    expect(editor.getSnapshot().photos.map((p) => p.caption)).toEqual([
      "",
      "Hello",
    ]);
  });
});
