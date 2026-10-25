import { editor } from "../core";
import { exportPhoto } from "../core/exportImage";
import type { Photo, Settings } from "../core/types";
import { AddPhotosIcon, SaveIcon } from "./icons";

export function NavBar({
  hasPhotos,
  photo,
  settings,
}: {
  hasPhotos: boolean;
  photo: Photo | undefined;
  settings: Settings;
}) {
  return (
    <div className="nav">
      <input
        id="fileinput"
        type="file"
        multiple={true}
        accept="image/jpeg"
        onChange={(e) => {
          void editor.openPhotos(e.target.files, "replace");
        }}
      />
      <label
        className="filebutton"
        htmlFor="fileinput"
        onClick={(e) => {
          // replacing clears the current photos, so check before opening the picker
          if (
            hasPhotos &&
            !window.confirm(
              "Load new photos? Your current photos and edits will be lost.",
            )
          ) {
            e.preventDefault();
          }
        }}
      >
        <AddPhotosIcon />
      </label>
      <span className="spacer" />
      {/* <span className="app-title">Photo-mat-ic</span>
      <span className="spacer" /> */}
      <button
        aria-label="Save"
        title="Save"
        // wait for the full image so the placeholder is never exported
        disabled={!photo?.image}
        onClick={() => {
          if (photo) exportPhoto(photo, settings);
        }}
      >
        <SaveIcon />
      </button>
    </div>
  );
}
