import type { ReactNode } from "react";
import { editor } from "../core";
import type { Photo, Settings } from "../core/types";
import {
  CaptionIcon,
  CropIcon,
  DarkIcon,
  ExifIcon,
  LightIcon,
  RoundedIcon,
  SquareIcon,
} from "./icons";

const SHAPE_LABELS = {
  original: "Crop: Original",
  portrait: "Crop: Portrait",
  landscape: "Crop: Landscape",
};

function Toggle({
  label,
  checked,
  disabled,
  onChange,
  children,
}: {
  label: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="cb">
      <input
        disabled={disabled}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.currentTarget.checked)}
      />
      <span className="screenreader">{label}</span>
      {children}
    </label>
  );
}

export function Toolbar({
  photo,
  settings,
}: {
  photo: Photo | undefined;
  settings: Settings;
}) {
  const disabled = !photo;
  const shape = photo?.crop.shape ?? "original";

  return (
    <div className="actions">
      <div className="toggles">
        <Toggle
          label="Rounded corners"
          checked={settings.rounded}
          disabled={disabled}
          onChange={(rounded) => editor.setSettings({ rounded })}
        >
          {settings.rounded ? <RoundedIcon /> : <SquareIcon />}
        </Toggle>
        <Toggle
          label={SHAPE_LABELS[shape]}
          checked={shape !== "original"}
          disabled={disabled}
          onChange={() => editor.cycleShape()}
        >
          <CropIcon shape={shape} />
        </Toggle>
        <Toggle
          label="Show EXIF"
          checked={settings.exif}
          disabled={disabled}
          onChange={(exif) => editor.setSettings({ exif })}
        >
          <ExifIcon />
        </Toggle>
        <Toggle
          label="Show caption"
          checked={settings.caption}
          disabled={disabled}
          onChange={(caption) => editor.setSettings({ caption })}
        >
          <CaptionIcon />
        </Toggle>
        <Toggle
          label={settings.bg === "white" ? "Light" : "Dark"}
          checked={settings.bg === "white"}
          disabled={disabled}
          onChange={(light) =>
            editor.setSettings({ bg: light ? "white" : "black" })
          }
        >
          {settings.bg === "white" ? <LightIcon /> : <DarkIcon />}
        </Toggle>
      </div>
      {settings.caption ? (
        <input
          className="caption-input"
          type="text"
          placeholder="Caption"
          value={photo?.caption ?? ""}
          onChange={(e) => editor.setCaption(e.currentTarget.value)}
        />
      ) : null}
    </div>
  );
}
