import { useCallback } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

// Registers the service worker and reports when a new version is waiting.
// Browsers only check for a new service worker on navigation, so an installed
// app left open would never notice a deploy; check periodically and whenever
// it comes back to the foreground too.
export function useAppUpdate() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      const check = () => {
        if (navigator.onLine && !registration.installing) {
          registration.update().catch(() => {});
        }
      };
      setInterval(check, UPDATE_INTERVAL_MS);
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") check();
      });
    },
  });

  // Activates the waiting service worker and reloads into the new version.
  const update = useCallback(
    () => updateServiceWorker(true),
    [updateServiceWorker],
  );

  return { needRefresh, update };
}
