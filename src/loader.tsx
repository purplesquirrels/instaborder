import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import Lottie from "react-lottie-player";
import "./loader.css";
import lottieJson from "./loader.json";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <div className="fsloader">
      <Lottie
        loop
        animationData={lottieJson}
        play
        style={{ width: 150, height: 150 }}
      />
      {
        <span>
          Loading
          {/* Loading {photoshop.loadstate[0]} of {photoshop.loadstate[1]} */}
        </span>
      }
    </div>
  </StrictMode>
);
