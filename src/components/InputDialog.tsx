import { useEffect, useRef, useState } from "react";
import { IconClose } from "./icons";

export interface InputDialogRequest {
  title: string;
  label: string;
  placeholder?: string;
  initialValue?: string;
  confirmLabel?: string;
  hint?: string;
  /** return an error string to keep the dialog open and explain why */
  validate?: (value: string) => string | null;
  onSubmit: (value: string) => void;
}

interface InputDialogProps {
  request: InputDialogRequest;
  onClose: () => void;
}

/**
 * A small in-app prompt. Browser `prompt()` is modal to the whole tab, looks
 * nothing like the rest of the app, and is blocked outright in some contexts —
 * so anything that needs a single value asks here instead.
 */
export const InputDialog = ({ request, onClose }: InputDialogProps) => {
  const [value, setValue] = useState(request.initialValue ?? "");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const submit = () => {
    const trimmed = value.trim();
    const problem = request.validate?.(trimmed) ?? null;
    if (problem) {
      setError(problem);
      return;
    }
    request.onSubmit(trimmed);
    onClose();
  };

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog compact" onClick={(e) => e.stopPropagation()}>
        <header>
          <h2>{request.title}</h2>
          <button className="icon-button" aria-label="Close" onClick={onClose}>
            <IconClose />
          </button>
        </header>

        <div className="dialog-body">
          <div className="field">
            <label className="field-label" htmlFor="input-dialog-field">
              {request.label}
            </label>
            <input
              id="input-dialog-field"
              ref={inputRef}
              type="text"
              value={value}
              placeholder={request.placeholder}
              onChange={(event) => {
                setValue(event.target.value);
                setError(null);
              }}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") {
                  event.preventDefault();
                  submit();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  onClose();
                }
              }}
            />
            {error ? (
              <p className="hint error">{error}</p>
            ) : (
              request.hint && <p className="hint">{request.hint}</p>
            )}
          </div>
        </div>

        <footer>
          <div className="spacer" />
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={submit}>
            {request.confirmLabel ?? "Confirm"}
          </button>
        </footer>
      </div>
    </div>
  );
};
