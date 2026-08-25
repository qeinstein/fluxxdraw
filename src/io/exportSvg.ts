import rough from "roughjs/bin/rough";
import type { BinaryFile, ExcaliElement, TextElement } from "../types";
import { getCommonBounds, getElementCenter } from "../geometry";
import { freedrawPath, getDrawables } from "../render/shapes";
import { baselineOffset, getLabelBox, getTextLines, measureText } from "../elements/text";
import { FONT_BY_ID, fontAsDataUrl, fontStack } from "../fonts";

const SVG_NS = "http://www.w3.org/2000/svg";
export const SVG_METADATA_ID = "scene-source";

export interface ExportSvgOptions {
  elements: ExcaliElement[];
  files: Record<string, BinaryFile>;
  padding: number;
  background: boolean;
  backgroundColor: string;
  /** embed the scene JSON so the SVG can be reopened for editing */
  embedScene: boolean;
  sceneJson?: string;
  /** scales the viewport size attributes; the vector content is resolution-free */
  scale: number;
  /** inline the fonts used, so the file renders identically elsewhere */
  embedFonts?: boolean;
  theme?: "light" | "dark";
}

const appendTextElement = (
  parent: SVGElement,
  el: TextElement,
  container: ExcaliElement | null,
) => {
  const lines = getTextLines(el, container);
  const lineHeightPx = el.fontSize * el.lineHeight;
  const { width: textWidth, height: textHeight } = measureText(lines, el);

  let originX = el.x;
  let originY = el.y;
  let boxWidth = el.width;

  if (container) {
    const box = getLabelBox(container, textWidth, textHeight, el.verticalAlign);
    originX = box.x;
    originY = box.y;
    boxWidth = box.width;
  }

  const anchor =
    el.textAlign === "center" ? "middle" : el.textAlign === "right" ? "end" : "start";
  const anchorX =
    el.textAlign === "center"
      ? originX + boxWidth / 2
      : el.textAlign === "right"
        ? originX + boxWidth
        : originX;

  const baseline = baselineOffset(el);
  const text = document.createElementNS(SVG_NS, "text");
  text.setAttribute("x", String(anchorX));
  text.setAttribute("y", String(originY + baseline));
  text.setAttribute("font-family", fontStack(el.fontFamily));
  text.setAttribute("font-size", `${el.fontSize}px`);
  text.setAttribute("fill", el.strokeColor);
  text.setAttribute("text-anchor", anchor);
  text.setAttribute("white-space", "pre");

  lines.forEach((line, i) => {
    const tspan = document.createElementNS(SVG_NS, "tspan");
    tspan.setAttribute("x", String(anchorX));
    tspan.setAttribute("y", String(originY + i * lineHeightPx + baseline));
    tspan.textContent = line;
    text.appendChild(tspan);
  });
  parent.appendChild(text);
};

/** Builds the SVG document for a set of elements. */
export const exportToSvgElement = (opts: ExportSvgOptions): SVGSVGElement => {
  const { elements, files, padding, background, backgroundColor, scale } = opts;
  if (elements.length === 0) throw new Error("Nothing to export");

  const bounds = getCommonBounds(elements);
  const width = Math.max(bounds.x2 - bounds.x1 + padding * 2, 1);
  const height = Math.max(bounds.y2 - bounds.y1 + padding * 2, 1);

  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("xmlns", SVG_NS);
  svg.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
  svg.setAttribute("width", String(Math.ceil(width * scale)));
  svg.setAttribute("height", String(Math.ceil(height * scale)));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);

  if (opts.embedScene && opts.sceneJson) {
    const metadata = document.createElementNS(SVG_NS, "metadata");
    metadata.setAttribute("id", SVG_METADATA_ID);
    // XMLSerializer escapes this, so arbitrary JSON round-trips safely
    metadata.textContent = opts.sceneJson;
    svg.appendChild(metadata);
  }

  if (background) {
    const rect = document.createElementNS(SVG_NS, "rect");
    rect.setAttribute("x", "0");
    rect.setAttribute("y", "0");
    rect.setAttribute("width", String(width));
    rect.setAttribute("height", String(height));
    rect.setAttribute("fill", backgroundColor);
    svg.appendChild(rect);
  }

  const root = document.createElementNS(SVG_NS, "g");
  root.setAttribute("transform", `translate(${-bounds.x1 + padding} ${-bounds.y1 + padding})`);
  if (opts.theme === "dark") {
    root.setAttribute("filter", "invert(93%) hue-rotate(180deg)");
  }
  svg.appendChild(root);

  const rc = rough.svg(svg);
  const byId = new Map(elements.map((el) => [el.id, el]));

  const frames = elements.filter((el) => !el.isDeleted && el.type === "frame");
  const rest = elements.filter((el) => !el.isDeleted && el.type !== "frame");

  for (const el of [...frames, ...rest]) {
    const group = document.createElementNS(SVG_NS, "g");
    const transforms: string[] = [];
    if (el.angle) {
      const [cx, cy] = getElementCenter(el);
      transforms.push(`rotate(${(el.angle * 180) / Math.PI} ${cx} ${cy})`);
    }
    if (transforms.length) group.setAttribute("transform", transforms.join(" "));
    if (el.opacity !== 100) group.setAttribute("opacity", String(el.opacity / 100));

    switch (el.type) {
      case "text":
        appendTextElement(
          group,
          el,
          el.containerId ? (byId.get(el.containerId) ?? null) : null,
        );
        break;
      case "image": {
        const file = files[el.fileId];
        if (file) {
          const image = document.createElementNS(SVG_NS, "image");
          image.setAttribute("href", file.dataURL);
          image.setAttribute("x", String(el.x));
          image.setAttribute("y", String(el.y));
          image.setAttribute("width", String(el.width));
          image.setAttribute("height", String(el.height));
          if (el.crop) {
            // emulate cropping by clipping the scaled-up image to the element box
            const clipId = `crop-${el.id}`;
            const clip = document.createElementNS(SVG_NS, "clipPath");
            clip.setAttribute("id", clipId);
            const clipRect = document.createElementNS(SVG_NS, "rect");
            clipRect.setAttribute("x", String(el.x));
            clipRect.setAttribute("y", String(el.y));
            clipRect.setAttribute("width", String(el.width));
            clipRect.setAttribute("height", String(el.height));
            clip.appendChild(clipRect);
            group.appendChild(clip);
            image.setAttribute("width", String(el.width / el.crop.w));
            image.setAttribute("height", String(el.height / el.crop.h));
            image.setAttribute("x", String(el.x - (el.crop.x * el.width) / el.crop.w));
            image.setAttribute("y", String(el.y - (el.crop.y * el.height) / el.crop.h));
            image.setAttribute("clip-path", `url(#${clipId})`);
          }
          group.appendChild(image);
        }
        break;
      }
      case "embed": {
        const rect = document.createElementNS(SVG_NS, "rect");
        rect.setAttribute("x", String(el.x));
        rect.setAttribute("y", String(el.y));
        rect.setAttribute("width", String(el.width));
        rect.setAttribute("height", String(el.height));
        rect.setAttribute("fill", "#f1f3f5");
        rect.setAttribute("stroke", "#adb5bd");
        group.appendChild(rect);
        break;
      }
      case "freedraw": {
        const d = freedrawPath(el);
        if (d) {
          const path = document.createElementNS(SVG_NS, "path");
          path.setAttribute("d", d);
          path.setAttribute("fill", el.strokeColor);
          path.setAttribute("transform", `translate(${el.x} ${el.y})`);
          group.appendChild(path);
        }
        break;
      }
      default: {
        const inner = document.createElementNS(SVG_NS, "g");
        inner.setAttribute("transform", `translate(${el.x} ${el.y})`);
        for (const drawable of getDrawables(el)) inner.appendChild(rc.draw(drawable));
        group.appendChild(inner);
      }
    }
    root.appendChild(group);
  }

  return svg;
};

/**
 * Inlines the fonts a drawing actually uses as base64 @font-face rules.
 *
 * Without this an exported SVG renders in whatever the viewer happens to have
 * installed, which for a hand-drawn diagram means it looks wrong everywhere
 * but the machine that made it.
 */
const embedFonts = async (svg: SVGSVGElement, elements: ExcaliElement[]) => {
  const used = new Set(
    elements.filter((el) => el.type === "text").map((el) => el.fontFamily),
  );
  if (used.size === 0) return;

  const faces = await Promise.all(
    [...used].map(async (id) => {
      const font = FONT_BY_ID.get(id);
      if (!font) return null;
      const dataUrl = await fontAsDataUrl(font);
      if (!dataUrl) return null;
      return `@font-face { font-family: "${font.family}"; src: url(${dataUrl}) format("woff2"); font-weight: 400; font-style: normal; }`;
    }),
  );

  const css = faces.filter(Boolean).join("\n");
  if (!css) return;

  const style = document.createElementNS(SVG_NS, "style");
  style.textContent = css;
  svg.insertBefore(style, svg.firstChild);
};

export const exportToSvgString = async (opts: ExportSvgOptions): Promise<string> => {
  const svg = exportToSvgElement(opts);
  if (opts.embedFonts !== false) await embedFonts(svg, opts.elements);
  return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(svg)}`;
};

/** Reads scene JSON back out of an SVG previously exported with `embedScene`. */
export const extractSvgScene = (svgText: string): string | null => {
  const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
  if (doc.querySelector("parsererror")) return null;
  const metadata =
    doc.getElementById(SVG_METADATA_ID) ?? doc.querySelector("metadata");
  const content = metadata?.textContent?.trim();
  return content && content.startsWith("{") ? content : null;
};
