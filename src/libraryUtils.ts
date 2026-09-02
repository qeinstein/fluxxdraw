import type { ThemeName } from "./constants";

export interface SearchableLibraryItem {
  id: string;
  name: string;
}

const normalize = (value: string) => value.trim().toLowerCase();

/** Filters personal-library items by every entered word. */
export const filterLibraryItems = <T extends SearchableLibraryItem>(items: T[], query: string): T[] => {
  const terms = normalize(query).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return items;
  return items.filter((item) => {
    const haystack = `${item.name} ${item.id}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
};

const isWhite = (value: unknown) => {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  if (normalized === "white") return true;
  const hex = normalized.replace(/^#/, "");
  const full = hex.length === 3 ? hex.split("").map((char) => char + char).join("") : hex;
  if (!/^[0-9a-f]{6}$/.test(full)) return false;
  return Number.parseInt(full.slice(0, 2), 16) > 235 &&
    Number.parseInt(full.slice(2, 4), 16) > 235 &&
    Number.parseInt(full.slice(4, 6), 16) > 235;
};

const isBlack = (value: unknown) => {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  if (normalized === "black") return true;
  const hex = normalized.replace(/^#/, "");
  const full = hex.length === 3 ? hex.split("").map((char) => char + char).join("") : hex;
  if (!/^[0-9a-f]{6}$/.test(full)) return false;
  return Number.parseInt(full.slice(0, 2), 16) < 35 &&
    Number.parseInt(full.slice(2, 4), 16) < 35 &&
    Number.parseInt(full.slice(4, 6), 16) < 35;
};

/**
 * Makes imported library strokes readable on the active canvas. Excalidraw
 * libraries often contain white strokes copied from dark canvases; retaining
 * those literal values on a light canvas makes the component look empty.
 * Saved library data is never changed.
 */
export const adaptLibraryElementsForTheme = <T extends Record<string, any>>(
  elements: T[],
  theme: ThemeName,
): T[] => elements.map((element) => {
  const next = { ...element } as Record<string, any>;
  if (theme === "light") {
    if (isWhite(next["strokeColor"])) next["strokeColor"] = "#1e1e1e";
    if (isWhite(next["textColor"])) next["textColor"] = "#1e1e1e";
  } else {
    if (isBlack(next["strokeColor"])) next["strokeColor"] = "#ffffff";
    if (isBlack(next["textColor"])) next["textColor"] = "#ffffff";
  }
  return next as T;
});

/** Contrast surface for previews, including all-white imported components. */
export const libraryPreviewBackground = (elements: Record<string, any>[], theme: ThemeName) => {
  const hasWhiteInk = elements.some((element) => isWhite(element.strokeColor) || isWhite(element.textColor));
  const hasBlackInk = elements.some((element) => isBlack(element.strokeColor) || isBlack(element.textColor));
  if (theme === "light" && hasWhiteInk && !hasBlackInk) return "#252a34";
  if (theme === "dark" && hasBlackInk && !hasWhiteInk) return "#f4f6f8";
  return theme === "dark" ? "#121212" : "#ffffff";
};
