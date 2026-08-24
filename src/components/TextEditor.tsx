import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { store } from "../store";
import { refreshBindings, refreshTextLayout } from "../actions";
import { fontString } from "../elements/text";
import { CONTAINER_PADDING, FONT_STACKS } from "../constants";
import { getElementBounds } from "../geometry";
import type { TextElement } from "../types";

interface TextEditorProps {
  elementId: string;
  onDone: () => void;
}

/**
 * A textarea overlaid on the canvas, positioned and styled to match how the
 * text will render once committed.
 */
export const TextEditor = ({ elementId, onDone }: TextEditorProps) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  const element = store.getElement(elementId) as TextElement | null;
  const [value, setValue] = useState(element?.text ?? "");

  useLayoutEffect(() => {
    const textarea = ref.current;
    if (!textarea) return;
    textarea.focus();
    textarea.select();
  }, []);

  // Live-update the element so the container grows while typing. The element
  // is read inside the effect rather than depended on, since every store
  // update replaces it and would otherwise re-trigger this endlessly.
  useEffect(() => {
    const current = store.getElement(elementId) as TextElement | null;
    if (!current) return;
    if (current.text === value) return;
    store.updateElement<TextElement>(elementId, () => ({ text: value }));
    refreshTextLayout([elementId]);
    if (current.containerId) refreshBindings([current.containerId]);
    store.emit();
  }, [value, elementId]);

  if (!element) return null;

  const container = element.containerId ? store.getElement(element.containerId) : null;
  const { scrollX, scrollY, zoom } = store.appState;

  const bounds = container ? getElementBounds(container) : getElementBounds(element);
  const sceneX = container ? bounds.x1 + CONTAINER_PADDING : element.x;
  const sceneY = container ? bounds.y1 + CONTAINER_PADDING : element.y;
  const width = container
    ? bounds.x2 - bounds.x1 - CONTAINER_PADDING * 2
    : Math.max(element.width, element.fontSize * 4);
  const height = container
    ? bounds.y2 - bounds.y1 - CONTAINER_PADDING * 2
    : Math.max(element.height, element.fontSize * element.lineHeight);

  const commit = () => {
    const current = store.getElement(elementId) as TextElement | null;
    if (current && current.text.trim() === "") {
      // an empty label leaves nothing behind
      const ids = [elementId];
      store.deleteElements(ids);
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
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === "Escape") {
          event.preventDefault();
          commit();
        }
        // Enter inserts a newline; Cmd/Ctrl+Enter finishes editing
        if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          commit();
        }
      }}
      style={{
        left: (sceneX + scrollX) * zoom,
        top: (sceneY + scrollY) * zoom,
        width: width * zoom,
        height: height * zoom,
        font: fontString({
          fontSize: element.fontSize * zoom,
          fontFamily: element.fontFamily,
        }),
        fontFamily: FONT_STACKS[element.fontFamily],
        lineHeight: element.lineHeight,
        color: element.strokeColor,
        textAlign: element.textAlign,
        opacity: element.opacity / 100,
      }}
    />
  );
};
