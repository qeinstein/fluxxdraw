import { mapColorAcrossThemes, PALETTE, type ThemeName } from "./constants";
import { store } from "./store";

/**
 * Switches theme and re-maps every palette colour in the scene to its
 * counterpart, so a drawing made in light mode stays legible in dark mode
 * (black strokes become white, pale fills become deep ones) instead of
 * disappearing into the background.
 *
 * Colours the user picked from the custom picker aren't in either ramp and are
 * deliberately left alone — those are choices, not defaults.
 */
export const setTheme = (next: ThemeName) => {
  const current = store.appState.theme;
  if (current === next) return;

  store.mutate(() => {
    const ids = store.elements.map((el) => el.id);
    store.updateElements(ids, (el) => ({
      strokeColor: mapColorAcrossThemes(el.strokeColor, current, next, "stroke"),
      backgroundColor: mapColorAcrossThemes(
        el.backgroundColor,
        current,
        next,
        "background",
      ),
    }));

    const style = store.appState.currentStyle;
    store.appState = {
      ...store.appState,
      theme: next,
      viewBackgroundColor: mapColorAcrossThemes(
        store.appState.viewBackgroundColor,
        current,
        next,
        "canvas",
      ),
      currentStyle: {
        ...style,
        strokeColor: mapColorAcrossThemes(style.strokeColor, current, next, "stroke"),
        backgroundColor: mapColorAcrossThemes(
          style.backgroundColor,
          current,
          next,
          "background",
        ),
      },
    };
  });
};

/**
 * Picks a sensible theme for a scene that was just opened. Files from other
 * tools may not record a theme at all, so this falls back to the perceived
 * lightness of the canvas colour.
 */
export const inferTheme = (viewBackgroundColor: string): ThemeName => {
  if ((PALETTE.dark.canvas as readonly string[]).includes(viewBackgroundColor)) return "dark";
  if ((PALETTE.light.canvas as readonly string[]).includes(viewBackgroundColor)) return "light";

  const hex = viewBackgroundColor.trim().replace("#", "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (full.length !== 6) return "light";

  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return "light";

  // Rec. 601 luma; below the midpoint reads as a dark canvas
  return (r * 299 + g * 587 + b * 114) / 1000 < 128 ? "dark" : "light";
};
