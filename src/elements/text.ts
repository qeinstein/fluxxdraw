import { CONTAINER_PADDING, FONT_STACKS } from "../constants";
import type { ExcaliElement, TextElement } from "../types";

let measureCtx: CanvasRenderingContext2D | null = null;

const getMeasureContext = () => {
  if (!measureCtx) {
    measureCtx = document.createElement("canvas").getContext("2d")!;
  }
  return measureCtx;
};

export const fontString = (el: Pick<TextElement, "fontSize" | "fontFamily">) =>
  `${el.fontSize}px ${FONT_STACKS[el.fontFamily]}`;

export const measureLine = (
  line: string,
  el: Pick<TextElement, "fontSize" | "fontFamily">,
) => {
  const ctx = getMeasureContext();
  ctx.font = fontString(el);
  return ctx.measureText(line).width;
};

/** Greedy word wrap; falls back to breaking mid-word for tokens wider than maxWidth. */
export const wrapText = (
  text: string,
  el: Pick<TextElement, "fontSize" | "fontFamily">,
  maxWidth: number,
): string[] => {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    if (paragraph === "") {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of paragraph.split(" ")) {
      const candidate = current ? `${current} ${word}` : word;
      if (measureLine(candidate, el) <= maxWidth || current === "") {
        // a single word wider than the container still has to be broken up
        if (current === "" && measureLine(word, el) > maxWidth) {
          let chunk = "";
          for (const char of word) {
            if (measureLine(chunk + char, el) > maxWidth && chunk) {
              lines.push(chunk);
              chunk = char;
            } else {
              chunk += char;
            }
          }
          current = chunk;
          continue;
        }
        current = candidate;
      } else {
        lines.push(current);
        current = word;
      }
    }
    lines.push(current);
  }
  return lines;
};

/**
 * Lines a text element renders as. Bound labels wrap to their container's
 * width; standalone text only breaks on explicit newlines.
 */
export const getTextLines = (el: TextElement, container: ExcaliElement | null): string[] => {
  if (container) {
    const maxWidth = Math.max(Math.abs(container.width) - CONTAINER_PADDING * 2, 20);
    return wrapText(el.text, el, maxWidth);
  }
  return el.text.split("\n");
};

/**
 * Distance from the top of a line box down to the text baseline.
 *
 * This mirrors how CSS positions text inside a line box (half the leading,
 * then the ascent), so the canvas rendering lines up exactly with the textarea
 * used for editing and the text doesn't shift when you finish typing.
 */
export const baselineOffset = (
  el: Pick<TextElement, "fontSize" | "lineHeight">,
) => ((el.lineHeight - 1) / 2 + 0.8) * el.fontSize;

export const measureText = (
  lines: string[],
  el: Pick<TextElement, "fontSize" | "fontFamily" | "lineHeight">,
) => {
  const width = lines.reduce((max, line) => Math.max(max, measureLine(line, el)), 0);
  return { width, height: Math.max(lines.length, 1) * el.fontSize * el.lineHeight };
};
