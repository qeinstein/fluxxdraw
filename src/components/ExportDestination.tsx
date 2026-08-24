import { useState } from "react";
import { IconFolder } from "./icons";
import {
  clearExportDirectory,
  pickExportDirectory,
  supportsDirectoryPicker,
} from "../io/fileSystem";

interface ExportDestinationProps {
  directoryName: string | null;
  onDirectoryChange: (name: string | null) => void;
}

/**
 * Lets the user nominate a folder that every export lands in. Falls back to
 * plain downloads on browsers without the File System Access API.
 */
export const ExportDestination = ({
  directoryName,
  onDirectoryChange,
}: ExportDestinationProps) => {
  const [error, setError] = useState<string | null>(null);
  const supported = supportsDirectoryPicker();

  if (!supported) {
    return (
      <p className="hint">
        Exports go to your browser's Downloads folder. Choosing a specific folder needs the File
        System Access API, which today means a Chromium browser (Chrome, Edge, Arc, Brave).
      </p>
    );
  }

  const choose = async () => {
    setError(null);
    try {
      const handle = await pickExportDirectory();
      if (handle) onDirectoryChange(handle.name);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const clear = async () => {
    await clearExportDirectory();
    onDirectoryChange(null);
  };

  return (
    <div className="destination">
      {directoryName ? (
        <>
          <span className="folder">
            <IconFolder />
            {directoryName}
          </span>
          <button onClick={choose}>Change…</button>
          <button onClick={clear}>Use downloads</button>
        </>
      ) : (
        <>
          <span className="hint">Downloads folder</span>
          <button onClick={choose}>Choose a folder…</button>
        </>
      )}
      {error && <p className="hint error">{error}</p>}
    </div>
  );
};
