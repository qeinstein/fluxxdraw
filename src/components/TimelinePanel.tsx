import { useEffect, useMemo, useRef, useState } from "react";
import { store, useScene } from "../store";
import { diffElements, formatClock, relativeTime, type ElementDiff } from "../io/history";
import { Tooltip } from "./Tooltip";
import { IconClose } from "./icons";
import type { ExcaliElement } from "../types";

interface TimelinePanelProps {
  onClose: () => void;
}

/**
 * Scrubber over the document's own history.
 *
 * Scrubbing only previews: the live scene is stashed and restored on exit, so
 * looking through the past never costs you the present. Restoring or branching
 * is an explicit action.
 */
export const TimelinePanel = ({ onClose }: TimelinePanelProps) => {
  const scene = useScene();
  const checkpoints = scene.timeline.checkpoints;
  const lastIndex = Math.max(checkpoints.length - 1, 0);

  const [index, setIndex] = useState(lastIndex);
  const [playing, setPlaying] = useState(false);
  const [compare, setCompare] = useState(false);
  /** the scene as it was before we started previewing */
  const liveRef = useRef<ExcaliElement[] | null>(null);
  const now = Date.now();

  // enter preview mode for as long as the panel is open
  useEffect(() => {
    liveRef.current = store.elements;
    store.previewing = true;
    return () => {
      // always hand the live scene back on the way out
      if (liveRef.current) store.elements = liveRef.current;
      store.previewing = false;
      store.emit();
    };
  }, []);

  const showAt = (next: number) => {
    const clamped = Math.max(0, Math.min(next, lastIndex));
    setIndex(clamped);
    store.elements =
      clamped === lastIndex && liveRef.current
        ? liveRef.current
        : store.timeline.reconstruct(clamped);
    store.appState = { ...store.appState, selectedIds: [], editingTextId: null };
    store.emit();
  };

  useEffect(() => {
    if (!playing) return;
    if (index >= lastIndex) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => showAt(index + 1), 260);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, index, lastIndex]);

  const diff: ElementDiff | null = useMemo(() => {
    if (!compare || index === 0) return null;
    return diffElements(
      store.timeline.reconstruct(index - 1),
      store.timeline.reconstruct(index),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compare, index, scene.getVersion()]);

  const current = checkpoints[index];
  const atLatest = index === lastIndex;

  const restore = () => {
    const elements = store.timeline.reconstruct(index);
    // Put the live scene back before mutating, so undo/redo and the new
    // checkpoint are both based on the present rather than on the preview.
    if (liveRef.current) store.elements = liveRef.current;
    store.previewing = false;
    store.mutate(() => {
      store.replaceElements(elements);
    });
    store.timeline.labelLatest(`Restored ${relativeTime(current.t, now)} state`);
    liveRef.current = elements;
    onClose();
  };

  if (checkpoints.length === 0) {
    return (
      <div className="timeline island">
        <p className="hint">No history yet — it starts recording as you draw.</p>
        <button className="icon-button" onClick={onClose} aria-label="Close">
          <IconClose />
        </button>
      </div>
    );
  }

  return (
    <div className="timeline island">
      <div className="timeline-head">
        <div className="timeline-title">
          <strong>{current?.label ?? relativeTime(current.t, now)}</strong>
          <span className="hint">
            {formatClock(current.t)} · {index + 1} of {checkpoints.length}
            {atLatest && " · latest"}
          </span>
        </div>

        <label className="checkbox">
          <input
            type="checkbox"
            checked={compare}
            onChange={(e) => setCompare(e.target.checked)}
          />
          <span>Highlight changes</span>
        </label>

        <Tooltip label="Close history" shortcut="Esc" placement="top">
          <button className="icon-button" onClick={onClose} aria-label="Close history">
            <IconClose />
          </button>
        </Tooltip>
      </div>

      <div className="timeline-track">
        <Tooltip label={playing ? "Pause" : "Play through history"} placement="top">
          <button
            className="timeline-play"
            aria-label={playing ? "Pause" : "Play"}
            onClick={() => {
              if (index >= lastIndex) showAt(0);
              setPlaying((v) => !v);
            }}
          >
            {playing ? "❙❙" : "▶"}
          </button>
        </Tooltip>

        <input
          className="slider timeline-slider"
          type="range"
          min={0}
          max={lastIndex}
          step={1}
          value={index}
          aria-label="Scrub through history"
          onChange={(e) => {
            setPlaying(false);
            showAt(Number(e.target.value));
          }}
        />

        <div className="timeline-actions">
          {diff && (
            <span className="diff-summary">
              <span className="diff added">+{diff.added.length}</span>
              <span className="diff changed">~{diff.changed.length}</span>
              <span className="diff removed">−{diff.removed.length}</span>
            </span>
          )}
          <button onClick={() => showAt(index - 1)} disabled={index === 0}>
            Older
          </button>
          <button onClick={() => showAt(index + 1)} disabled={atLatest}>
            Newer
          </button>
          <button className="primary" onClick={restore} disabled={atLatest}>
            Restore this version
          </button>
        </div>
      </div>

      {/* named checkpoints double as bookmarks along the track */}
      <div className="timeline-marks">
        {checkpoints.map((cp, i) =>
          cp.label ? (
            <button
              key={cp.id}
              className={`timeline-mark ${i === index ? "active" : ""}`}
              style={{ left: `${lastIndex === 0 ? 0 : (i / lastIndex) * 100}%` }}
              title={`${cp.label} · ${formatClock(cp.t)}`}
              onClick={() => showAt(i)}
            />
          ) : null,
        )}
      </div>
    </div>
  );
};
