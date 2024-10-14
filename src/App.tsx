import * as ExifReader from "exifreader";
import { FormEvent, useEffect, useRef, useState } from "react";
// import "./App.css";

async function getFile() {
  // Open file picker and destructure the result the first handle
  const [fileHandle] = await window.showOpenFilePicker({
    types: [
      {
        description: "Images",
        accept: {
          "image/*": [".jpeg", ".jpg"],
        },
      },
    ],
    excludeAcceptAllOption: true,
    multiple: false,
  });
  const file = await fileHandle.getFile();
  return file;
}

// function squircleRect(x: number, y: number, w: number, h: number, n: number) {
//   const squircleoid = new Path2D();
//   if (typeof n === "undefined") n = 1.0;
//   const hw = 0.5 * w;
//   const hh = 0.5 * h;
//   squircleoid.moveTo(x + hw, y); // top mid
//   squircleoid.bezierCurveTo(
//     x + hw * (1 - n),
//     y,
//     x,
//     y + hh * (1 - n),
//     x,
//     y + hh
//   ); // left mid
//   squircleoid.bezierCurveTo(
//     x,
//     y + hh + n * hh,
//     x + hw - n * hw,
//     y + h,
//     x + hw,
//     y + h
//   ); // bottom mid
//   squircleoid.bezierCurveTo(
//     x + hw + n * hw,
//     y + h,
//     x + w,
//     y + hh + n * hh,
//     x + w,
//     y + hh
//   ); // right mid
//   squircleoid.bezierCurveTo(
//     x + w,
//     y + hh - n * hh,
//     x + hw + n * hw,
//     y,
//     x + hw,
//     y
//   ); // top mid
//   return squircleoid;
// }

function roundedRect(x: number, y: number, w: number, h: number, r: number) {
  const roundRect = new Path2D();
  roundRect.moveTo(x + r, y);
  roundRect.arcTo(x, y, x, y + h - r, r); // top-left
  roundRect.arcTo(x, y + h, x + w - r, y + h, r); // bottom-left
  roundRect.arcTo(x + w, y + h, x + w, y + h - r, r); // bottom-right
  roundRect.arcTo(x + w, y, x + w - r, y, r); // top-right
  roundRect.lineTo(x + r, y);
  return roundRect;
}

const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1080;

function App() {
  const canvas = useRef<HTMLCanvasElement | null>(null);

  const [exifEnabled, setExifEnabled] = useState(false);
  const [glow, setGlow] = useState(false);
  const [bg, setBg] = useState<string>("black");
  const [file, setFile] = useState<File | null>(null);
  const [exif, setExif] = useState<ExifReader.Tags | null>(null);

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");

    if (ctx && file) {
      const img = new Image();
      img.onload = () => {
        const exposure = exif?.["ExposureTime"]?.description;
        const ap = exif?.["FNumber"]?.description;
        const iso = exif?.["ISOSpeedRatings"]?.description;
        const focal = exif?.["FocalLengthIn35mmFilm"]?.description;

        const meta = [
          focal ? focal + "mm" : false,
          ap,
          iso ? "ISO" + iso : false,
          exposure,
        ]
          .filter(Boolean)
          .join(" | ");

        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

        const marginX = 100;
        const marginY = 100;
        const radius = 16;

        const aspect = img.naturalWidth / img.naturalHeight;

        // calculate width and height if landscape
        let w = CANVAS_WIDTH - marginX;
        let h = w / aspect;

        // size if portrait
        if (h > CANVAS_HEIGHT - marginY) {
          h = CANVAS_HEIGHT - marginY;
          w = h * aspect;
        }

        let x = marginX * 0.5;
        let y = ctx.canvas.height * 0.5 - h * 0.5;

        // position if portrait
        if (h === CANVAS_HEIGHT - marginY) {
          x = ctx.canvas.width * 0.5 - w * 0.5;
          y = marginY * 0.5;
        }
        if (glow) {
          ctx.filter = "blur(300px)";
          ctx.globalAlpha = 0.65;
          ctx.drawImage(img, x, y, w, h);
          ctx.filter = "none";
          ctx.globalAlpha = 1;
        }

        ctx.save();

        ctx.clip(roundedRect(x, y, w, h, radius));

        ctx.drawImage(img, x, y, w, h);

        ctx.restore();

        if (exifEnabled) {
          ctx.fillStyle = "#999";
          ctx.font = "bold 24px Courier New";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(meta, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 20);
        }
      };
      img.src = URL.createObjectURL(file);
    }
  }, [file, exif, exifEnabled, bg, glow]);

  return (
    <div className="card">
      <div className="actions">
        <button
          onClick={async () => {
            const f = await getFile();

            const tags = await ExifReader.load(f);

            console.log(tags);

            setExif(tags);
            setFile(f);
          }}
        >
          Open
        </button>
        <button
          onClick={async () => {
            if (!file) return;

            const options: SaveFilePickerOptions = {
              types: [
                {
                  description: "Images",
                  accept: {
                    "image/jpeg": [".jpeg"],
                  },
                },
              ],
              suggestedName: `${file.name}_bordered.jpeg`,
            };

            canvas.current?.toBlob(
              async (blob) => {
                if (!blob) {
                  alert("Save error");
                  return;
                }
                const imgFileHandle = await window.showSaveFilePicker(options);

                console.log("Save File chosen");

                const writable = await imgFileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
              },
              "image/jpeg",
              1
            );
          }}
        >
          Save
        </button>
        <label>
          <input
            type="checkbox"
            checked={exifEnabled}
            onChange={(e: FormEvent<HTMLInputElement>) =>
              setExifEnabled(e.currentTarget.checked)
            }
          />
          <span>EXIF</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={bg === "white"}
            onChange={(e: FormEvent<HTMLInputElement>) =>
              setBg(e.currentTarget.checked ? "white" : "black")
            }
          />
          <span>Light</span>
        </label>
        <label>
          <input
            type="checkbox"
            checked={glow}
            onChange={(e: FormEvent<HTMLInputElement>) =>
              setGlow(e.currentTarget.checked)
            }
          />
          <span>Aura</span>
        </label>
        {/* <label>
          <input
            type="color"
            value={bg}
            onChange={(e: FormEvent<HTMLInputElement>) =>
              setBg(e.currentTarget.value)
            }
          />
          <span>Background</span>
        </label> */}
      </div>
      <canvas
        ref={canvas}
        width={CANVAS_HEIGHT}
        height={CANVAS_HEIGHT}
      ></canvas>
    </div>
  );
}

export default App;
