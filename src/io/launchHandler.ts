/**
 * OS file-association plumbing.
 *
 * When FluxxDraw is installed as a PWA, the manifest's `file_handlers` entry
 * registers `.fluxx` with the operating system. Double-clicking one then opens
 * the app and delivers the file through `launchQueue` — this is the only
 * web-native path to "double-click a file, my site opens it".
 */

interface LaunchParams {
  files: FileSystemFileHandle[];
  targetURL?: string;
}

interface LaunchQueue {
  setConsumer: (consumer: (params: LaunchParams) => void) => void;
}

export const supportsFileHandling = () =>
  typeof window !== "undefined" && "launchQueue" in window;

/**
 * Registers the handler for files opened from the OS. Must be called during
 * startup: the queue replays anything that arrived before the consumer was set,
 * but only delivers to the first consumer registered.
 */
export const consumeLaunchFiles = (
  onFile: (file: File, handle: FileSystemFileHandle) => void,
) => {
  const queue = (window as unknown as { launchQueue?: LaunchQueue }).launchQueue;
  if (!queue) return;

  queue.setConsumer(async (params) => {
    if (!params.files?.length) return;
    for (const handle of params.files) {
      try {
        onFile(await handle.getFile(), handle);
      } catch (error) {
        console.warn("Could not read a file passed in at launch", error);
      }
      // one document per window keeps the editor's single-file model honest
      break;
    }
  });
};

/** Registers the service worker, which is what makes the app installable. */
export const registerServiceWorker = () => {
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return; // the dev server has no built SW to serve
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((error) => console.warn("Service worker registration failed", error));
  });
};
