/**
 * One table of keyboard shortcuts, shared by the handler that runs them and
 * every label that advertises them. Keeping both sides on the same data is
 * what stops the menus from promising combos the app doesn't listen for.
 *
 * Combos are written platform-neutrally — `mod` is ⌘ on Apple keyboards and
 * Ctrl everywhere else — and rendered per platform by `formatCombo`.
 */

/**
 * Every hint the browser gives about the platform, concatenated.
 *
 * No single source is reliable: `userAgentData.platform` is missing on Safari
 * and Firefox, `navigator.platform` is deprecated and reports "MacIntel" for
 * iPads, and a UA can be overridden. Searching all three together is more
 * robust than picking a favourite and hoping.
 */
const platformHints = (): string => {
  const data = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData;
  return [data?.platform, navigator.platform, navigator.userAgent].filter(Boolean).join(" ");
};

/** Apple keyboards put the modifier on ⌘ and spell the others in symbols. */
export const isApple = /mac|iphone|ipad|ipod/i.test(platformHints());

export const KEY = {
  mod: isApple ? "⌘" : "Ctrl",
  shift: isApple ? "⇧" : "Shift",
  alt: isApple ? "⌥" : "Alt",
};

/**
 * Every combo the app listens for.
 *
 * Punctuation and digits are named by their physical key (`bracketright`,
 * `digit1`) rather than the character they produce, because that character
 * moves: ⌘⇧] arrives as `}`, and Shift+1 is only `!` on some layouts. Both of
 * those silently broke the shortcuts that used to match on the character.
 *
 * Deliberately avoided: anything the browser or OS eats before the page sees
 * it. `mod+H` is "hide window" on macOS, `mod+shift+T` is "reopen closed tab"
 * in Chrome, and `mod+shift+P` is a private window in Firefox — none can be
 * intercepted, so the three actions that claimed them use plain Shift combos.
 */
export const SHORTCUTS = {
  undo: "mod+z",
  redo: "mod+shift+z",
  redoAlt: "mod+y",
  selectAll: "mod+a",
  duplicate: "mod+d",
  group: "mod+g",
  ungroup: "mod+shift+g",
  lock: "mod+shift+l",
  bringToFront: "mod+bracketright",
  bringForward: "mod+shift+bracketright",
  sendToBack: "mod+bracketleft",
  sendBackward: "mod+shift+bracketleft",
  open: "mod+o",
  save: "mod+s",
  saveAs: "mod+shift+s",
  export: "mod+shift+e",
  diagramText: "mod+slash",
  history: "shift+h",
  present: "shift+p",
  tidyUp: "shift+t",
  services: "shift+c",
  zoomIn: "mod+equal",
  zoomInAlt: "mod+shift+equal",
  zoomOut: "mod+minus",
  zoomReset: "mod+digit0",
  zoomToFit: "shift+digit1",
  toggleToolLock: "q",
  help: "shift+slash",
} as const;

export type ShortcutId = keyof typeof SHORTCUTS;

/** Where the glyph users read differs from the physical key name. */
const LABEL_OVERRIDES: Partial<Record<ShortcutId, string>> = {
  help: "?",
};

/** Physical-key tokens, matched against `event.code`. */
const CODES: Record<string, string> = {
  slash: "Slash",
  bracketleft: "BracketLeft",
  bracketright: "BracketRight",
  equal: "Equal",
  minus: "Minus",
};

/** How each physical key is written in a label. */
const GLYPHS: Record<string, string> = {
  Slash: "/",
  BracketLeft: "[",
  BracketRight: "]",
  Equal: "+",
  Minus: "−",
};

interface Parsed {
  mod: boolean;
  shift: boolean;
  alt: boolean;
  /** compared against `event.key`, lowercased — used for letters */
  key: string | null;
  /** compared against `event.code` — used for punctuation and digits */
  code: string | null;
}

const parseCache = new Map<string, Parsed>();

const parse = (combo: string): Parsed => {
  const cached = parseCache.get(combo);
  if (cached) return cached;

  const parsed: Parsed = { mod: false, shift: false, alt: false, key: null, code: null };
  for (const part of combo.toLowerCase().split("+")) {
    if (part === "mod") parsed.mod = true;
    else if (part === "shift") parsed.shift = true;
    else if (part === "alt") parsed.alt = true;
    else if (part.startsWith("digit")) parsed.code = `Digit${part.slice(5)}`;
    else if (CODES[part]) parsed.code = CODES[part];
    else parsed.key = part;
  }
  parseCache.set(combo, parsed);
  return parsed;
};

/**
 * Whether an event is this combo.
 *
 * `mod` accepts either ⌘ or Ctrl on every platform: a Mac user with a PC
 * keyboard habit gets the same result, and nothing else is bound to the pair.
 */
export const matches = (event: KeyboardEvent, combo: string): boolean => {
  const want = parse(combo);
  if (want.mod !== (event.metaKey || event.ctrlKey)) return false;
  if (want.shift !== event.shiftKey) return false;
  if (want.alt !== event.altKey) return false;
  if (want.code) return event.code === want.code;
  return event.key.toLowerCase() === want.key;
};

/** Renders a combo the way this platform's users expect to read it. */
export const formatCombo = (combo: string): string => {
  const { mod, shift, alt, key, code } = parse(combo);
  const base = code
    ? (GLYPHS[code] ?? code.replace("Digit", ""))
    : (key ?? "").toUpperCase();

  /*
   * Each platform has its own house style for writing a combo. Apple orders
   * the glyphs ⌥⇧⌘ with ⌘ against the key and no separators; Windows and Linux
   * put Ctrl first and join with plus signs.
   */
  const parts = isApple
    ? [alt && KEY.alt, shift && KEY.shift, mod && KEY.mod, base]
    : [mod && KEY.mod, alt && KEY.alt, shift && KEY.shift, base];

  return parts.filter(Boolean).join(isApple ? "" : "+");
};

/** Formatted label for a named shortcut, for tooltips, menus and the help sheet. */
export const sc = (id: ShortcutId): string => LABEL_OVERRIDES[id] ?? formatCombo(SHORTCUTS[id]);
