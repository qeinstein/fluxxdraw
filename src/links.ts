import { store } from "./store";
import type { ExcaliElement } from "./types";

/**
 * Links on elements, pointing either out at the web or back into the same
 * drawing.
 *
 * An internal link is the document's own URL with `#element=<id>`, which means
 * one shape can send you to another: a phase box that jumps to the frame for
 * that phase, an overview that leads into detail. It also means the link works
 * as a plain URL — paste it in a message and whoever opens the file lands on
 * that element.
 */

const FRAGMENT = "#element=";

export const elementLink = (id: string): string =>
  `${location.origin}${location.pathname}${FRAGMENT}${id}`;

/** The element id an internal link points at, or null if it points elsewhere. */
export const parseElementLink = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const at = value.indexOf(FRAGMENT);
  if (at === -1) return null;
  const id = value.slice(at + FRAGMENT.length).split(/[&/?]/)[0];
  return id || null;
};

/** The id in the current address bar, for opening a link someone sent you. */
export const linkedElementFromUrl = (): string | null => parseElementLink(location.hash);

/**
 * Accepts what someone actually pastes. An internal link is kept verbatim so it
 * survives being copied out again; anything else gets a scheme if it's missing
 * one, and is rejected if it still doesn't parse.
 */
export const normaliseLink = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (parseElementLink(trimmed)) return trimmed;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    return url.hostname.includes(".") || url.protocol === "mailto:" ? url.toString() : null;
  } catch {
    return null;
  }
};

export const setElementLink = (ids: string[], link: string | null) => {
  store.mutate(() => {
    for (const id of ids) store.updateElement(id, () => ({ link }));
  });
};

/**
 * Where the link badge sits, in scene coordinates, kept a constant size on
 * screen so it stays clickable at any zoom.
 *
 * Fully above the top edge and right-aligned, which keeps it off the corner
 * resize handle and away from the rotation handle over the top centre.
 */
export const linkBadgeBox = (el: ExcaliElement, zoom: number) => {
  const size = 20 / zoom;
  const gap = 8 / zoom;
  const left = Math.min(el.x, el.x + el.width);
  const top = Math.min(el.y, el.y + el.height);
  return { x: left + Math.abs(el.width) - size, y: top - size - gap, size };
};

export const hitLinkBadge = (x: number, y: number, zoom: number): ExcaliElement | null => {
  for (let i = store.visibleElements.length - 1; i >= 0; i--) {
    const el = store.visibleElements[i];
    if (!el.link) continue;
    const box = linkBadgeBox(el, zoom);
    if (x >= box.x && x <= box.x + box.size && y >= box.y && y <= box.y + box.size) return el;
  }
  return null;
};
