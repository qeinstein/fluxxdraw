import architectsDaughter from "@fontsource/architects-daughter/files/architects-daughter-latin-400-normal.woff2?url";
import caveat from "@fontsource/caveat/files/caveat-latin-400-normal.woff2?url";
import gloria from "@fontsource/gloria-hallelujah/files/gloria-hallelujah-latin-400-normal.woff2?url";
import patrickHand from "@fontsource/patrick-hand/files/patrick-hand-latin-400-normal.woff2?url";
import nunito from "@fontsource/nunito/files/nunito-latin-400-normal.woff2?url";
import jetbrainsMono from "@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff2?url";

import type { FontFamily } from "./types";

/**
 * The drawing fonts, self-hosted so a drawing looks the same on any machine
 * and works offline. Each entry knows its own file, which lets SVG exports
 * inline the font rather than hoping the viewer happens to have it.
 */
export interface FontSpec {
  id: FontFamily;
  /** shown in the style panel */
  label: string;
  /** CSS family name, matching the @font-face declarations */
  family: string;
  /** used when the webfont hasn't loaded or isn't embedded */
  fallback: string;
  url: string;
}

export const FONTS: FontSpec[] = [
  {
    id: "hand",
    label: "Hand",
    family: "Architects Daughter",
    fallback: '"Segoe Print", "Bradley Hand", cursive',
    url: architectsDaughter,
  },
  {
    id: "casual",
    label: "Casual",
    family: "Caveat",
    fallback: '"Segoe Script", cursive',
    url: caveat,
  },
  {
    id: "marker",
    label: "Marker",
    family: "Gloria Hallelujah",
    fallback: '"Comic Sans MS", cursive',
    url: gloria,
  },
  {
    id: "neat",
    label: "Neat",
    family: "Patrick Hand",
    fallback: '"Comic Sans MS", cursive',
    url: patrickHand,
  },
  {
    id: "normal",
    label: "Normal",
    family: "Nunito",
    fallback: '"Helvetica Neue", Helvetica, Arial, sans-serif',
    url: nunito,
  },
  {
    id: "code",
    label: "Code",
    family: "JetBrains Mono",
    fallback: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
    url: jetbrainsMono,
  },
];

export const FONT_BY_ID = new Map(FONTS.map((font) => [font.id, font]));

export const fontStack = (id: FontFamily) => {
  const font = FONT_BY_ID.get(id) ?? FONTS[0];
  return `"${font.family}", ${font.fallback}`;
};

/** Injects the @font-face rules once, at startup. */
export const installFontFaces = () => {
  const style = document.createElement("style");
  style.dataset.fluxxFonts = "true";
  style.textContent = FONTS.map(
    (font) => `@font-face {
  font-family: "${font.family}";
  src: url("${font.url}") format("woff2");
  font-weight: 400;
  font-style: normal;
  /*
   * "swap" instead of "block": on a slow connection the fallback in the
   * stack renders immediately so typing never hits an invisible-text
   * window, then it's swapped for the real drawing font once it lands.
   */
  font-display: swap;
}`,
  ).join("\n");
  document.head.appendChild(style);
};

/**
 * Resolves once every drawing font is usable.
 *
 * Text is measured against the real font metrics, so anything laid out before
 * the fonts land would be sized against a fallback and jump afterwards. The
 * app waits for this, then re-measures.
 */
export const loadFonts = async (): Promise<void> => {
  if (!("fonts" in document)) return;
  await Promise.all(
    FONTS.map((font) =>
      document.fonts.load(`16px "${font.family}"`).catch(() => undefined),
    ),
  );
  await document.fonts.ready;
};

const embeddedCache = new Map<string, string>();

/** Fetches a font file and returns it as a data URL, for inlining into SVG. */
export const fontAsDataUrl = async (font: FontSpec): Promise<string | null> => {
  const cached = embeddedCache.get(font.id);
  if (cached) return cached;
  try {
    const response = await fetch(font.url);
    if (!response.ok) return null;
    const buffer = new Uint8Array(await response.arrayBuffer());
    let binary = "";
    // chunked to stay clear of the argument-count limit on large files
    for (let i = 0; i < buffer.length; i += 0x8000) {
      binary += String.fromCharCode(...buffer.subarray(i, i + 0x8000));
    }
    const dataUrl = `data:font/woff2;base64,${btoa(binary)}`;
    embeddedCache.set(font.id, dataUrl);
    return dataUrl;
  } catch {
    return null;
  }
};
