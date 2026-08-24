import { zoomToElement } from "./components/ZoomControls";
import { parseElementLink } from "./links";

/**
 * Follows a link on an element: internal ones move the view, external ones open
 * a tab. Kept apart from `links.ts` so the pure URL helpers stay importable by
 * the renderer without dragging viewport code in with them.
 *
 * Returns a message when there's something worth telling the user, and null
 * when the jump just happened.
 */
export const followLink = (link: string): string | null => {
  const target = parseElementLink(link);
  if (target) {
    return zoomToElement(target) ? null : "That link points at something that's no longer here.";
  }
  window.open(link, "_blank", "noopener,noreferrer");
  return null;
};
