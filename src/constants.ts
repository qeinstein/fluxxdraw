import type { AppState } from "./types";

export const APP_NAME = "FluxxDraw";
/** Native document extension, without the dot. */
export const FILE_EXTENSION = "fluxx";

/**
 * Palettes are index-aligned across themes: entry N in the light stroke ramp
 * is the same logical colour as entry N in the dark one. Switching theme walks
 * that mapping, so a black line becomes white rather than vanishing.
 */
export const PALETTE = {
  light: {
    stroke: ["#1e1e1e", "#e03131", "#2f9e44", "#1971c2", "#f08c00"],
    background: ["transparent", "#ffc9c9", "#b2f2bb", "#a5d8ff", "#ffec99"],
    canvas: ["#ffffff", "#f8f9fa", "#f4f7fb", "#fffcf0", "#fdf7f5"],
  },
  dark: {
    stroke: ["#e9e9ee", "#ff8787", "#69db7c", "#74c0fc", "#ffd43b"],
    background: ["transparent", "#5c2b2b", "#22502f", "#1e3f5e", "#544117"],
    canvas: ["#12121a", "#17171f", "#141a20", "#1b1810", "#1a1315"],
  },
} as const;

export type ThemeName = keyof typeof PALETTE;
export type PaletteRole = keyof (typeof PALETTE)["light"];

/**
 * Translates a colour from one theme's palette to the other's. Custom colours
 * the user picked themselves aren't in either ramp, so they're left untouched.
 */
export const mapColorAcrossThemes = (
  color: string,
  from: ThemeName,
  to: ThemeName,
  role: PaletteRole,
): string => {
  const index = (PALETTE[from][role] as readonly string[]).indexOf(color);
  if (index === -1) return color;
  return PALETTE[to][role][index];
};

/**
 * A sticky note is a filled square with a centred label — a rectangle and a
 * bound text, not a new element type, so it selects, resizes, takes arrows,
 * exports and serialises through everything that already exists.
 */
export const STICKY_SIZE = 168;
/** index into a theme's background ramp: the yellow one */
export const STICKY_COLOR_INDEX = 4;

export const STROKE_WIDTHS = { thin: 1, bold: 2, extraBold: 4 } as const;
export const FONT_SIZES = { S: 16, M: 20, L: 28, XL: 36 } as const;

export const LINE_HEIGHT = 1.25;

/** Padding between a container's edge and its bound label. */
export const CONTAINER_PADDING = 8;

/** Pointer distance (in scene units) that still counts as a hit on a stroke. */
export const HIT_THRESHOLD = 10;

export const HANDLE_SIZE = 8;
export const ROTATE_HANDLE_OFFSET = 20;

/** How close an arrow endpoint must be to a shape to bind to it. */
export const BINDING_DISTANCE = 24;
export const BINDING_GAP = 4;

export const SNAP_THRESHOLD = 6;

export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 30;

export const LASER_FADE_MS = 1000;

export const DEFAULT_APP_STATE: AppState = {
  tool: "selection",
  selectedIds: [],
  editingTextId: null,
  scrollX: 0,
  scrollY: 0,
  zoom: 1,
  viewBackgroundColor: PALETTE.light.canvas[0],
  theme: "light",
  gridSize: null,
  snapToObjects: true,
  currentStyle: {
    strokeColor: PALETTE.light.stroke[0],
    backgroundColor: "transparent",
    fillStyle: "hachure",
    strokeWidth: 1,
    strokeStyle: "solid",
    roughness: 1,
    edges: "round",
    opacity: 100,
    fontSize: 20,
    fontFamily: "hand",
    textAlign: "left",
    startArrowhead: "none",
    endArrowhead: "arrow",
    elbowed: false,
  },
};
