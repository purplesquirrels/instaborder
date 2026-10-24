import type * as ExifReader from "exifreader";

export type CropShape = "original" | "portrait" | "landscape";

export interface Crop {
  zoom: number;
  // visible centre, in normalised image coords (0-1)
  cx: number;
  cy: number;
  shape: CropShape;
}

export interface Photo {
  id: number;
  // object URL of the filmstrip thumbnail
  url: string;
  // name of the picked file; the File itself isn't kept, as Android may
  // revoke access to it
  name: string;
  // stored copy that full-size decodes read from
  source: File;
  exif: ExifReader.Tags | null;
  caption: string;
  crop: Crop;
  // small placeholder, drawn until `image` has been decoded
  thumb: ImageBitmap;
  // working-resolution bitmap, only kept for recently viewed photos
  image: ImageBitmap | null;
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type Background = "black" | "white";

export interface Settings {
  exif: boolean;
  caption: boolean;
  bg: Background;
  rounded: boolean;
  glow: boolean;
}

export type Phase = "start" | "loading" | "editing";

export interface EditorState {
  photos: Photo[];
  // [loaded, total]
  loadstate: [number, number];
  selectedIndex: number;
  phase: Phase;
  settings: Settings;
}
