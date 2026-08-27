import { useLayoutEffect, useRef, useState } from "react";
import { store, useScene } from "../store";
import { refreshBindings, refreshTextLayout } from "../actions";
import { fontString, getLabelBox, measureText, wrapText } from "../elements/text";
import { CONTAINER_PADDING, resolveColor } from "../constants";
import { fontStack } from "../fonts";
import type { TextElement } from "../types";

interface TextEditorProps {
  elementId: string;
  onDone: () => void;
}

/**
 * A textarea overlaid on the canvas, sized and styled to match how the text
 * will render once committed.
 *
 * The box grows with what you type — outwards for free-floating text, and
 * downwards (wrapping) for a label bound inside a shape — so typing never runs
 * out of room or gets clipped.
 */
export const TextEditor = ({ elementId, onDone }: TextEditorProps) => {
  useScene(); // subscribe so style changes (e.g. strokeColor) re-render us live
  const ref = useRef<HTMLTextAreaElement>(null);
  const element = store.getElement(elementId) as TextElement | null;
  const [value, setValue] = useState(element?.text ?? "");
  const committedRef = useRef(false);
  /**
   * The pointer event that opens the editor finishes settling focus *after*
   * React mounts us, so an immediate blur is the browser tidying up rather
   * than the user clicking away. Only honour blur once focus has landed.
   */
  const [focusSettled, setFocusSettled] = useState(false);

  useLayoutEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;
    const frame = requestAnimationFrame(() => {
      textarea.focus();
      // put the caret at the end rather than selecting, so typing appends
      const end = textarea.value.length;
      textarea.setSelectionRange(end, end);
      setFocusSettled(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  /**
   * Pushes the typed text straight into the scene so the shape grows as you
   * type. Done in the change handler rather than an effect: writing to the
   * store notifies subscribers synchronously, and doing that from an effect
   * sets up a render/effect feedback loop.
   */
  const applyText = (next: string) => {
    setValue(next);
    const current = store.getElement(elementId) as TextElement | null;
    if (!current || current.text === next) return;
    store.updateElement<TextElement>(elementId, () => ({ text: next }));
    refreshTextLayout([elementId]);
    if (current.containerId) refreshBindings([current.containerId]);
    store.emit();
  };

  if (!element) return null;

  const container = element.containerId ? store.getElement(element.containerId) : null;
  const { scrollX, scrollY, zoom, theme } = store.appState;

  // Measure the text being typed, including the line currently in progress, so
  // the box is always at least as large as its content.
  const measuredWidth = (() => {
    if (container) return null;
    const lines = value.length ? value.split("\n") : [""];
    return measureText(lines, element).width;
  })();

  const wrappedLineCount = (() => {
    const boxWidth = container
      ? Math.max(Math.abs(container.width) - CONTAINER_PADDING * 2, 20)
      : Infinity;
    const lines =
      container && value.length
        ? wrapText(value, element, boxWidth)
        : value.length
          ? value.split("\n")
          : [""];
    return Math.max(lines.length, 1);
  })();

  const lineHeightPx = element.fontSize * element.lineHeight;
  const contentHeight = wrappedLineCount * lineHeightPx;

  let sceneX: number;
  let sceneY: number;
  let width: number;
  let height: number;

  if (container) {
    const measured = measureText(
      value.length ? value.split("\n") : [""],
      element,
    ).width;
    const box = getLabelBox(container, measured, contentHeight, element.verticalAlign);
    width = box.width;
    height = contentHeight;
    sceneX = box.x;
    sceneY = box.y;
  } else {
    // a little slack past the caret keeps typing from feeling cramped
    width = Math.max(measuredWidth ?? 0, element.fontSize * 0.6) + element.fontSize * 0.75;
    height = contentHeight;
    sceneX = element.x;
    sceneY = element.y;
  }

  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    const current = store.getElement(elementId) as TextElement | null;
    if (current && current.text.trim() === "") {
      // an empty label leaves nothing behind
      store.deleteElements([elementId]);
      if (current.containerId) {
        store.updateElement(current.containerId, () => ({ boundText: null }));
      }
    }
    store.commit();
    store.emit();
    onDone();
  };

  return (
    <textarea
      ref={ref}
      className="text-editor"
      value={value}
      spellCheck={false}
      autoComplete="off"
      autoCapitalize="off"
      autoCorrect="off"
      onChange={(event) => applyText(event.target.value)}
      onBlur={focusSettled ? commit : undefined}
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        // the canvas shortcuts must not fire while typing
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          commit();
          return;
        }
        // Enter inserts a newline; Cmd/Ctrl+Enter finishes
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          commit();
        }
      }}
      style={{
        left: (sceneX + scrollX) * zoom,
        top: (sceneY + scrollY) * zoom,
        width: Math.max(width, 4) * zoom,
        height: Math.max(height, lineHeightPx) * zoom,
        font: fontString({
          fontSize: element.fontSize * zoom,
          fontFamily: element.fontFamily,
        }),
        fontFamily: fontStack(element.fontFamily),
        lineHeight: element.lineHeight,
        color: resolveColor(element.strokeColor, theme, "stroke"),
        textAlign: element.textAlign,
        opacity: element.opacity / 100,
        // free text never wraps on its own; labels wrap inside their shape
        whiteSpace: container ? "pre-wrap" : "pre",
        overflow: "hidden",
      }}
    />
  );
};
