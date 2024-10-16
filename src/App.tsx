import * as ExifReader from "exifreader";
import {
  FormEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import Lottie from "react-lottie-player";
import lottieJson from "./loader.json";

interface PhotoData {
  url: string;
  file: File;
  exif: ExifReader.Tags | null;
  image: HTMLCanvasElement;
  width: number;
  height: number;
}

const CANVAS_WIDTH = 1440;
const CANVAS_HEIGHT = 1440;
const CANVAS_MARGIN = 25;

const APP_STATE = {
  Start: "start",
  Loading: "loading",
  Editing: "editing",
  Saving: "saving",
} as const;

type AppState = (typeof APP_STATE)[keyof typeof APP_STATE];

function createStore<T>(initialState: T): {
  getSnapshot: () => T;
  setState: (fn: (state: T) => T) => void;
  subscribe: (listener: () => void) => () => void;
} {
  let state = initialState;
  const getSnapshot = () => state;
  const listeners = new Set<() => void>();
  const setState = (fn: (state: T) => T) => {
    state = fn(state);
    listeners.forEach((l: () => void) => l());
  };
  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  return { getSnapshot, setState, subscribe };
}

const store = createStore<{ files: Array<PhotoData> }>({
  files: [],
});

function usePhotoshop() {
  return useSyncExternalStore(store.subscribe, () => store.getSnapshot());
}

function downloadImage(data: string, filename = "untitled.jpeg") {
  var a = document.createElement("a");
  a.href = data;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
}

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

function readFile(file: File): Promise<PhotoData | void> {
  return new Promise((resolve) => {
    var reader = new FileReader();

    // var worker = new Worker("image-worker.js");
    // console.log("start", file.name);

    reader.onloadend = async function () {
      const tags = await ExifReader.load(file);
      // console.log("reader done", file.name);

      const img = new Image();
      img.onload = () => {
        // console.log("img loaded", file.name);

        const offscreenCanvas = document.createElement("canvas");

        const marginL = CANVAS_MARGIN;
        const marginR = CANVAS_MARGIN;
        const marginT = CANVAS_MARGIN;
        const marginB = CANVAS_MARGIN;

        const aspect = img.naturalWidth / img.naturalHeight;

        // calculate width and height if landscape
        let w = CANVAS_WIDTH - marginL - marginR;
        let h = w / aspect;

        // size if portrait
        if (h > CANVAS_HEIGHT - marginT - marginB) {
          h = CANVAS_HEIGHT - marginT - marginB;
          w = h * aspect;
        }

        offscreenCanvas.width = w;
        offscreenCanvas.height = h;

        // worker.postMessage({
        //   imageData: img
        // })

        offscreenCanvas
          .getContext("2d", { alpha: false })
          ?.drawImage(img, 0, 0, w, h);

        const photo = {
          url: offscreenCanvas.toDataURL("image/jpeg", 0.8),
          file,
          exif: tags,
          image: offscreenCanvas,
          width: w,
          height: h,
        };

        store.setState((state) => {
          return { ...state, files: [...state.files, photo] };
        });

        resolve(photo);
      };
      img.onerror = () => {
        alert("Unable to load image");
        resolve();
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function App() {
  const canvas = useRef<HTMLCanvasElement | null>(null);

  const [exifEnabled, setExifEnabled] = useState(false);
  const [glow] = useState(false);
  const [bg, setBg] = useState<string>("black");
  const [rounded, setRounded] = useState<boolean>(true);
  const [selectedFile, setSelectedFile] = useState<number>(0);
  const [state, setState] = useState<AppState>("start");
  // const [loadCount, setLoadCount] = useState<number>(0);

  const photoshop = usePhotoshop();

  const files = photoshop.files;

  const hasSelectedFile = files?.[selectedFile];

  useEffect(() => {
    const ctx = canvas.current?.getContext("2d", { alpha: false });

    if (ctx && files?.[selectedFile]) {
      const exif = files[selectedFile].exif;
      const exposure = exif?.["ExposureTime"]?.description;
      const ap = exif?.["FNumber"]?.description;
      const iso = exif?.["ISOSpeedRatings"]?.description;
      const focal = exif?.["FocalLengthIn35mmFilm"]?.description;

      const meta = [
        focal ? focal + "mm" : false,
        ap,
        iso ? "ISO" + iso : false,
        exposure ? exposure + "s" : false,
      ]
        .filter(Boolean)
        .join(" | ");

      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

      const marginL = CANVAS_MARGIN;
      const marginR = CANVAS_MARGIN;
      const marginT = CANVAS_MARGIN;
      const marginB = exifEnabled && meta !== "" ? 100 : CANVAS_MARGIN;
      const radius = 30;

      const aspect = files[selectedFile].width / files[selectedFile].height;

      // calculate width and height if landscape
      let w = CANVAS_WIDTH - marginL - marginR;
      let h = w / aspect;

      // size if portrait
      if (h > CANVAS_HEIGHT - marginT - marginB) {
        h = CANVAS_HEIGHT - marginT - marginB;
        w = h * aspect;
      }

      let x = marginL;
      let y = ctx.canvas.height * 0.5 - h * 0.5;

      // position if portrait
      if (h === CANVAS_HEIGHT - marginT - marginB) {
        x = ctx.canvas.width * 0.5 - w * 0.5;
        y = marginT;
      }
      if (glow) {
        ctx.filter = "blur(300px)";
        ctx.globalAlpha = 0.65;
        ctx.drawImage(files[selectedFile].image, x, y, w, h);
        ctx.filter = "none";
        ctx.globalAlpha = 1;
      }

      ctx.save();
      if (rounded) {
        ctx.clip(roundedRect(x, y, w, h, radius));
      }
      ctx.drawImage(files[selectedFile].image, x, y, w, h);
      ctx.restore();

      if (exifEnabled) {
        ctx.fillStyle = bg === "black" ? "#999" : "#999";
        ctx.font = "bold 42px Courier New";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(meta, CANVAS_WIDTH / 2, CANVAS_HEIGHT - 48);
      }
    }
  }, [files, selectedFile, exifEnabled, bg, glow, rounded]);

  async function setFiles(
    files: FileList | null,
    action: "append" | "replace" = "replace"
  ) {
    // const fs = e.target.files;
    if (!files) return;

    const first = files[0];

    if (!first) return;

    // setLoadCount(files.length);
    setState("loading");

    console.log({ action });

    if (action === "replace") {
      store.setState((state) => {
        return { ...state, files: [] };
      });
      setSelectedFile(0);
    }

    for (let i = 0; i < files.length; i++) {
      await readFile(files[i]);
    }

    setState("editing");
  }

  return (
    <>
      <div className="nav">
        <input
          id="fileinput"
          type="file"
          multiple={true}
          accept="image/jpeg"
          onChange={async (e) => {
            setFiles(e.target.files, "replace");
          }}
        />
        <label className="filebutton" htmlFor="fileinput">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M5.5 8.5C5.5 6.84315 6.84315 5.5 8.5 5.5C10.1569 5.5 11.5 6.84315 11.5 8.5C11.5 10.1569 10.1569 11.5 8.5 11.5C6.84315 11.5 5.5 10.1569 5.5 8.5Z"
              fill="currentColor"
            />
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M12.5 2H7.7587C6.95374 1.99999 6.28937 1.99998 5.74818 2.04419C5.18608 2.09012 4.66937 2.18868 4.18404 2.43598C3.43139 2.81947 2.81947 3.43139 2.43598 4.18404C2.18868 4.66937 2.09012 5.18608 2.04419 5.74818C1.99998 6.28937 1.99999 6.95372 2 7.75869V16.2413C1.99999 17.0463 1.99998 17.7106 2.04419 18.2518C2.09012 18.8139 2.18868 19.3306 2.43598 19.816C2.81947 20.5686 3.43139 21.1805 4.18404 21.564C4.66937 21.8113 5.18608 21.9099 5.74818 21.9558C5.92356 21.9701 6.11188 21.9798 6.31374 21.9864C6.52305 22.0003 6.7734 22.0002 7.03144 22.0002C10.3543 22.0002 13.6771 22 17 22C17.0465 22 17.0924 22 17.1376 22C17.933 22.0005 18.5236 22.0008 19.0353 21.8637C20.4156 21.4938 21.4938 20.4156 21.8637 19.0353C22.039 18.381 22.0002 17.6804 22 17.0095C22.0018 16.8202 22.0001 16.6308 22.0001 16.4415C22.0006 15.9726 22.0011 15.5594 21.8923 15.1647C21.7969 14.8182 21.6399 14.4917 21.429 14.2007C21.1887 13.8692 20.8658 13.6114 20.4993 13.3189L17.6683 11.0541C17.4984 10.9182 17.3304 10.7838 17.1779 10.6797C17.0083 10.5639 16.7995 10.4436 16.5382 10.3766C16.1709 10.2824 15.7843 10.2946 15.4237 10.4118C15.1671 10.4951 14.9663 10.6283 14.8043 10.7545C14.6586 10.8681 14.4995 11.0128 14.3385 11.1592L5.83046 18.8938C5.61698 19.0878 5.41061 19.2754 5.2589 19.4395C5.19807 19.5054 5.10567 19.6077 5.01929 19.743C4.67627 19.5501 4.39723 19.2598 4.21799 18.908C4.1383 18.7516 4.07337 18.5274 4.03755 18.089C4.00078 17.6389 4 17.0566 4 16.2V7.8C4 6.94342 4.00078 6.36113 4.03755 5.91104C4.07337 5.47262 4.1383 5.24842 4.21799 5.09202C4.40973 4.7157 4.7157 4.40973 5.09202 4.21799C5.24842 4.1383 5.47262 4.07337 5.91104 4.03755C6.36113 4.00078 6.94342 4 7.8 4H12.5C13.0523 4 13.5 3.55229 13.5 3C13.5 2.44772 13.0523 2 12.5 2Z"
              fill="currentColor"
            />
            <path
              d="M20 2C20 1.44772 19.5523 1 19 1C18.4477 1 18 1.44772 18 2V4H16C15.4477 4 15 4.44772 15 5C15 5.55228 15.4477 6 16 6H18V8C18 8.55228 18.4477 9 19 9C19.5523 9 20 8.55228 20 8V6H22C22.5523 6 23 5.55228 23 5C23 4.44772 22.5523 4 22 4H20V2Z"
              fill="currentColor"
            />
          </svg>
        </label>
        <span className="spacer" />
        <span className="app-title">Photo-mat-ic</span>
        <span className="spacer" />
        <button
          aria-label="Save"
          title="Save"
          disabled={!hasSelectedFile}
          onClick={async () => {
            var dataURL = canvas.current?.toDataURL("image/jpeg", 1.0);

            if (!dataURL) return;

            downloadImage(
              dataURL,
              `${files?.[selectedFile]?.file.name?.replace(".", "_")}_mat.jpeg`
            );
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M13 3C13 2.44772 12.5523 2 12 2C11.4477 2 11 2.44772 11 3V14.5858L6.70711 10.2929C6.31658 9.90237 5.68342 9.90237 5.29289 10.2929C4.90237 10.6834 4.90237 11.3166 5.29289 11.7071L11.2929 17.7071C11.6834 18.0976 12.3166 18.0976 12.7071 17.7071L18.7071 11.7071C19.0976 11.3166 19.0976 10.6834 18.7071 10.2929C18.3166 9.90237 17.6834 9.90237 17.2929 10.2929L13 14.5858V3Z"
              fill="currentColor"
            />
            <path
              d="M2 21C2 20.4477 2.44772 20 3 20H21C21.5523 20 22 20.4477 22 21C22 21.5523 21.5523 22 21 22H3C2.44772 22 2 21.5523 2 21Z"
              fill="currentColor"
            />
          </svg>
        </button>
      </div>
      <div className="canvas-wrap">
        <canvas
          ref={canvas}
          width={CANVAS_HEIGHT}
          height={CANVAS_HEIGHT}
        ></canvas>
        {files && files.length > 0 ? (
          <div className="actions">
            <label className="cb">
              <input
                disabled={!hasSelectedFile}
                type="checkbox"
                checked={rounded}
                onChange={(e: FormEvent<HTMLInputElement>) =>
                  setRounded(e.currentTarget.checked)
                }
              />
              <span className="screenreader">Rounded corners</span>
              {rounded ? (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M7.7587 2H16.2413C17.0463 1.99999 17.7106 1.99998 18.2518 2.04419C18.8139 2.09012 19.3306 2.18868 19.816 2.43597C20.5686 2.81947 21.1805 3.43139 21.564 4.18404C21.8113 4.66937 21.9099 5.18608 21.9558 5.74817C22 6.28936 22 6.95372 22 7.75868V16.2413C22 17.0463 22 17.7106 21.9558 18.2518C21.9099 18.8139 21.8113 19.3306 21.564 19.816C21.1805 20.5686 20.5686 21.1805 19.816 21.564C19.3306 21.8113 18.8139 21.9099 18.2518 21.9558C17.7106 22 17.0463 22 16.2413 22H7.75868C6.95372 22 6.28936 22 5.74817 21.9558C5.18608 21.9099 4.66937 21.8113 4.18404 21.564C3.43139 21.1805 2.81947 20.5686 2.43597 19.816C2.18868 19.3306 2.09012 18.8139 2.04419 18.2518C1.99998 17.7106 1.99999 17.0463 2 16.2413V7.7587C1.99999 6.95373 1.99998 6.28937 2.04419 5.74817C2.09012 5.18608 2.18868 4.66937 2.43597 4.18404C2.81947 3.43139 3.43139 2.81947 4.18404 2.43597C4.66937 2.18868 5.18608 2.09012 5.74817 2.04419C6.28937 1.99998 6.95373 1.99999 7.7587 2ZM5.91104 4.03755C5.47262 4.07337 5.24842 4.1383 5.09202 4.21799C4.7157 4.40973 4.40973 4.7157 4.21799 5.09202C4.1383 5.24842 4.07337 5.47262 4.03755 5.91104C4.00078 6.36113 4 6.94342 4 7.8V16.2C4 17.0566 4.00078 17.6389 4.03755 18.089C4.07337 18.5274 4.1383 18.7516 4.21799 18.908C4.40973 19.2843 4.7157 19.5903 5.09202 19.782C5.24842 19.8617 5.47262 19.9266 5.91104 19.9624C6.36113 19.9992 6.94342 20 7.8 20H16.2C17.0566 20 17.6389 19.9992 18.089 19.9624C18.5274 19.9266 18.7516 19.8617 18.908 19.782C19.2843 19.5903 19.5903 19.2843 19.782 18.908C19.8617 18.7516 19.9266 18.5274 19.9624 18.089C19.9992 17.6389 20 17.0566 20 16.2V7.8C20 6.94342 19.9992 6.36113 19.9624 5.91104C19.9266 5.47262 19.8617 5.24842 19.782 5.09202C19.5903 4.7157 19.2843 4.40973 18.908 4.21799C18.7516 4.1383 18.5274 4.07337 18.089 4.03755C17.6389 4.00078 17.0566 4 16.2 4H7.8C6.94342 4 6.36113 4.00078 5.91104 4.03755Z"
                    fill="currentColor"
                  />
                </svg>
              ) : (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M20 4H4V20H20V4ZM2 2V22H22V2H2Z"
                    fill="currentColor"
                  />
                </svg>
              )}
            </label>
            <label className="cb">
              <input
                disabled={!hasSelectedFile}
                type="checkbox"
                checked={exifEnabled}
                onChange={(e: FormEvent<HTMLInputElement>) =>
                  setExifEnabled(e.currentTarget.checked)
                }
              />
              <span className="screenreader">Show EXIF</span>
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M10.0427 3.21425C8.42778 3.57242 6.8924 4.37969 5.63604 5.63604L5.63604 5.63604C5.39171 5.88037 5.16437 6.13525 4.95401 6.39922C7.40131 5.66177 10.0701 5.86589 12.3925 7.01534C12.9105 7.05588 13.4233 7.1768 13.9108 7.37809C13.1742 5.60656 11.8203 4.10837 10.0427 3.21425ZM13.3294 3.09815C15.1902 4.84846 16.3468 7.26035 16.513 9.84452C16.7412 10.3223 16.8892 10.8289 16.957 11.344C18.1231 9.82019 18.7436 7.8986 18.6289 5.91229C18.5429 5.8188 18.4546 5.72669 18.3639 5.63604C16.9457 4.21779 15.1719 3.37183 13.3294 3.09815ZM20.3741 8.69609C19.7895 11.1842 18.2786 13.3933 16.1229 14.8303C15.9521 15.0786 15.7563 15.3148 15.5355 15.5355C15.3799 15.6912 15.2166 15.8344 15.0468 15.9652C16.9502 16.213 18.9254 15.7889 20.5889 14.6952C21.2011 12.7383 21.1295 10.6137 20.3741 8.69609ZM19.046 17.6008C16.5986 18.3382 13.9298 18.1341 11.6074 16.9847C11.0894 16.9441 10.5765 16.8232 10.0891 16.6218C10.8257 18.3934 12.1796 19.8916 13.9572 20.7858C15.5721 20.4276 17.1076 19.6203 18.3639 18.3639C18.6083 18.1196 18.8356 17.8647 19.046 17.6008ZM10.6704 20.9018C8.80956 19.1514 7.6529 16.7394 7.48679 14.1551C7.25864 13.6773 7.11069 13.1708 7.04293 12.6558C5.87677 14.1795 5.25616 16.1011 5.37085 18.0874C5.4569 18.181 5.5453 18.2732 5.63604 18.3639C7.05424 19.7821 8.82799 20.6281 10.6704 20.9018ZM3.62578 15.3035C4.21044 12.8154 5.72146 10.6063 7.87731 9.16939C8.0481 8.92126 8.24381 8.68512 8.46446 8.46446C8.62009 8.30884 8.78342 8.16562 8.95323 8.03481C7.04982 7.78696 5.0746 8.21112 3.41112 9.30477C2.7989 11.2615 2.87045 13.386 3.62578 15.3035ZM11.9919 9.00001C11.2269 9.00205 10.4624 9.29494 9.87868 9.87868C8.70711 11.0502 8.70711 12.9498 9.87868 14.1213C11.0502 15.2929 12.9498 15.2929 14.1213 14.1213C14.2477 13.9949 14.3605 13.86 14.4596 13.7185C14.4985 13.6308 14.5502 13.5481 14.614 13.4737C15.0929 12.6253 15.1262 11.5934 14.7139 10.7195C14.6615 10.6465 14.6186 10.566 14.5872 10.4799C14.4609 10.2653 14.3056 10.063 14.1213 9.87868C13.5928 9.35016 12.9162 9.06007 12.225 9.0084C12.1479 9.01468 12.0697 9.01204 11.9919 9.00001ZM4.22183 4.22183C8.5176 -0.073941 15.4824 -0.0739441 19.7782 4.22183C24.0739 8.5176 24.0739 15.4824 19.7782 19.7782C15.4824 24.0739 8.51757 24.0739 4.22183 19.7782C-0.0739412 15.4824 -0.0739443 8.51757 4.22183 4.22183Z"
                  fill="currentColor"
                />
              </svg>
            </label>
            <label className="cb">
              <input
                disabled={!hasSelectedFile}
                type="checkbox"
                checked={bg === "white"}
                onChange={(e: FormEvent<HTMLInputElement>) =>
                  setBg(e.currentTarget.checked ? "white" : "black")
                }
              />
              <span className="screenreader">
                {bg === "white" ? "Light" : "Dark"}
              </span>
              {bg === "white" ? (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 1C12.5523 1 13 1.44772 13 2V4C13 4.55228 12.5523 5 12 5C11.4477 5 11 4.55228 11 4V2C11 1.44772 11.4477 1 12 1ZM4.1928 4.1928C4.58332 3.80227 5.21648 3.80227 5.60701 4.1928L7.02122 5.60701C7.41175 5.99753 7.41175 6.6307 7.02122 7.02122C6.6307 7.41175 5.99753 7.41175 5.60701 7.02122L4.1928 5.60701C3.80227 5.21648 3.80227 4.58332 4.1928 4.1928ZM19.8072 4.1928C20.1977 4.58332 20.1977 5.21648 19.8072 5.60701L18.393 7.02122C18.0025 7.41175 17.3693 7.41175 16.9788 7.02122C16.5883 6.6307 16.5883 5.99753 16.9788 5.60701L18.393 4.1928C18.7835 3.80227 19.4167 3.80227 19.8072 4.1928ZM12 8C9.79086 8 8 9.79086 8 12C8 14.2091 9.79086 16 12 16C14.2091 16 16 14.2091 16 12C16 9.79086 14.2091 8 12 8ZM6 12C6 8.68629 8.68629 6 12 6C15.3137 6 18 8.68629 18 12C18 15.3137 15.3137 18 12 18C8.68629 18 6 15.3137 6 12ZM1 12C1 11.4477 1.44772 11 2 11H4C4.55228 11 5 11.4477 5 12C5 12.5523 4.55228 13 4 13H2C1.44772 13 1 12.5523 1 12ZM19 12C19 11.4477 19.4477 11 20 11H22C22.5523 11 23 11.4477 23 12C23 12.5523 22.5523 13 22 13H20C19.4477 13 19 12.5523 19 12ZM7.02122 16.9829C7.41175 17.3734 7.41175 18.0066 7.02122 18.3971L5.60701 19.8113C5.21648 20.2018 4.58332 20.2018 4.1928 19.8113C3.80227 19.4208 3.80227 18.7876 4.1928 18.3971L5.60701 16.9829C5.99753 16.5924 6.6307 16.5924 7.02122 16.9829ZM16.9788 16.9829C17.3693 16.5924 18.0025 16.5924 18.393 16.9829L19.8072 18.3971C20.1977 18.7876 20.1977 19.4208 19.8072 19.8113C19.4167 20.2018 18.7835 20.2018 18.393 19.8113L16.9788 18.3971C16.5883 18.0066 16.5883 17.3734 16.9788 16.9829ZM12 19C12.5523 19 13 19.4477 13 20V22C13 22.5523 12.5523 23 12 23C11.4477 23 11 22.5523 11 22V20C11 19.4477 11.4477 19 12 19Z"
                    fill="currentColor"
                  />
                </svg>
              ) : (
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M8.86288 1.29292C9.15714 1.58718 9.23841 2.03292 9.06693 2.41209C8.53036 3.59857 8.23116 4.91628 8.23116 6.30656C8.23116 11.5325 12.4676 15.7689 17.6935 15.7689C19.0838 15.7689 20.4015 15.4697 21.5879 14.9331C21.9671 14.7616 22.4128 14.8429 22.7071 15.1371C23.0014 15.4314 23.0826 15.8771 22.9112 16.2563C21.1136 20.2311 17.1124 23 12.4623 23C6.13185 23 1 17.8682 1 11.5377C1 6.88764 3.76893 2.88642 7.74371 1.08887C8.12289 0.917396 8.56862 0.998664 8.86288 1.29292ZM6.41336 4.2608C4.32688 5.99715 3 8.6131 3 11.5377C3 16.7636 7.23642 21 12.4623 21C15.3869 21 18.0029 19.6732 19.7392 17.5867C19.0751 17.7064 18.3913 17.7689 17.6935 17.7689C11.363 17.7689 6.23116 12.637 6.23116 6.30656C6.23116 5.6087 6.29363 4.92496 6.41336 4.2608Z"
                    fill="currentColor"
                  />
                </svg>
              )}
            </label>
          </div>
        ) : null}
      </div>
      <div className="filmstrip">
        {files?.map((f, i) => (
          <img
            onDragStart={(e) => e.preventDefault()}
            onClick={() => setSelectedFile(i)}
            className={selectedFile === i ? "selected" : ""}
            key={i + f.file.name}
            src={f.url}
            alt={f.file.name}
            style={{ width: 100, height: 100, background: bg }}
          />
        ))}
        {files?.length > 0 && (
          <div className="filmstrip-add">
            <input
              id="addfileinput"
              type="file"
              multiple={true}
              accept="image/jpeg"
              onChange={async (e) => {
                setFiles(e.target.files, "append");
              }}
            />
            <label className="filebutton" htmlFor="addfileinput">
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 4C12.5523 4 13 4.44772 13 5V11H19C19.5523 11 20 11.4477 20 12C20 12.5523 19.5523 13 19 13H13V19C13 19.5523 12.5523 20 12 20C11.4477 20 11 19.5523 11 19V13H5C4.44772 13 4 12.5523 4 12C4 11.4477 4.44772 11 5 11H11V5C11 4.44772 11.4477 4 12 4Z"
                  fill="currentColor"
                />
              </svg>
            </label>
          </div>
        )}
      </div>
      {state === "loading" ? (
        <div className="fsloader">
          <Lottie
            loop
            animationData={lottieJson}
            play
            style={{ width: 150, height: 150 }}
          />
          {/* <span>
            Loading {files ? files.length + 1 : 1} of {loadCount}
          </span> */}
        </div>
      ) : null}
    </>
  );
}

export default App;
