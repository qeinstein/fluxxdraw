import type { InputDialogRequest } from "./components/InputDialog";

/**
 * Promise-based access to the in-app input dialog, so code deep in the canvas
 * can ask the user for a value without reaching for `window.prompt`.
 */

type Handler = (request: InputDialogRequest | null) => void;

let handler: Handler | null = null;

/** Called once by the app shell, which owns the rendered dialog. */
export const setPromptHandler = (next: Handler | null) => {
  handler = next;
};

export type PromptOptions = Omit<InputDialogRequest, "onSubmit">;

/** Resolves with the entered value, or null if the user dismissed the dialog. */
export const promptForInput = (options: PromptOptions): Promise<string | null> =>
  new Promise((resolve) => {
    if (!handler) {
      resolve(null);
      return;
    }
    let settled = false;
    const finish = (value: string | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    handler({
      ...options,
      onSubmit: (value) => finish(value),
    });

    // the shell calls this when the dialog closes without submitting
    pendingCancel = () => finish(null);
  });

let pendingCancel: (() => void) | null = null;

/** Invoked by the shell when the dialog is dismissed. */
export const cancelPrompt = () => {
  pendingCancel?.();
  pendingCancel = null;
};
