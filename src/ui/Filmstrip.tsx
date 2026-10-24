import { editor } from "../core";
import type { Background, Photo } from "../core/types";
import { CloseIcon, PlusIcon } from "./icons";

export function Filmstrip({
  photos,
  selectedIndex,
  pendingCount,
  bg,
}: {
  photos: Photo[];
  selectedIndex: number;
  pendingCount: number;
  bg: Background;
}) {
  return (
    <div className="filmstrip">
      {photos.map((f, i) => (
        <div className="filmstrip-item" key={f.id}>
          <img
            onDragStart={(e) => e.preventDefault()}
            onClick={() => editor.select(i)}
            className={selectedIndex === i ? "selected" : ""}
            src={f.url}
            alt={f.name}
            decoding="async"
            style={{ width: 100, height: 100, background: bg }}
          />
          {selectedIndex === i ? (
            <button
              className="filmstrip-delete"
              aria-label="Remove photo"
              title="Remove photo"
              onClick={() => editor.removePhoto(i)}
            >
              <CloseIcon />
            </button>
          ) : null}
        </div>
      ))}
      {pendingCount > 0 && photos.length > 0 && (
        <div
          className="filmstrip-pending"
          role="status"
          aria-label={`Loading ${pendingCount} more`}
        />
      )}
      {photos.length > 0 && (
        <div className="filmstrip-add">
          <input
            id="addfileinput"
            type="file"
            multiple={true}
            accept="image/jpeg"
            onChange={(e) => {
              void editor.openPhotos(e.target.files, "append");
            }}
          />
          <label className="filebutton" htmlFor="addfileinput">
            <PlusIcon />
          </label>
        </div>
      )}
    </div>
  );
}
