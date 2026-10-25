import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./ui/App.tsx";
import "./index.css";

// Size the layout from the measured viewport rather than dvh alone: in the
// installed Android app a pull-to-refresh reload can leave viewport units at
// a stale, too-tall height until the app is restarted. Re-measuring on every
// resize lets any corrected viewport fix the layout by itself.
function syncAppHeight() {
  const height = window.visualViewport?.height ?? window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${height}px`);
}
syncAppHeight();
window.addEventListener("resize", syncAppHeight);
window.addEventListener("orientationchange", syncAppHeight);
window.addEventListener("pageshow", syncAppHeight);
window.visualViewport?.addEventListener("resize", syncAppHeight);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
