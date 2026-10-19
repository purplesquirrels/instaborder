import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // New service workers wait until the app decides to activate them
      // (see useAppUpdate), so an update never reloads over an open photo.
      registerType: "prompt",
      injectRegister: false,
      // public/ is already covered by globPatterns below
      includeManifestIcons: false,
      manifest: {
        name: "Photo-mat-ic",
        short_name: "Photo-mat-ic",
        description: "Add simple frames around photos for Instagram.",
        display: "standalone",
        start_url: "/",
        scope: "/",
        theme_color: "#242424",
        background_color: "#242424",
        icons: [
          { src: "pwa-64x64.png", sizes: "64x64", type: "image/png" },
          { src: "pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "maskable-icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Everything the app needs is local, so precache the whole build.
        // Entries are revisioned by content hash and old caches are removed
        // when a new service worker activates.
        globPatterns: ["**/*.{js,css,html,svg,png,ico}"],
        cleanupOutdatedCaches: true,
        navigateFallback: "index.html",
      },
    }),
  ],
  build: {
    rollupOptions: {
      input: {
        main: "./index.html",
        nested: "./loader.html",
      },
    },
  },
});
