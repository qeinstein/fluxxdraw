import type { AppState } from "./types";

export const STROKE_COLORS = ["#1e1e1e", "#e03131", "#2f9e44", "#1971c2", "#f08c00"];
export const BACKGROUND_COLORS = ["transparent", "#ffc9c9", "#b2f2bb", "#a5d8ff", "#ffec99"];
export const CANVAS_COLORS = ["#ffffff", "#f8f9fa", "#f5faff", "#fffce8", "#fdf8f6"];

export const STROKE_WIDTHS = { thin: 1, bold: 2, extraBold: 4 } as const;
export const FONT_SIZES = { S: 16, M: 20, L: 28, XL: 36 } as const;

export const FONT_STACKS: Record<string, string> = {
  hand: '"Comic Sans MS", "Segoe Print", "Bradley Hand", cursive',
  normal: '"Helvetica Neue", Helvetica, Arial, sans-serif',
  code: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
};

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
  toolLocked: false,
  selectedIds: [],
  editingTextId: null,
  scrollX: 0,
  scrollY: 0,
  zoom: 1,
  viewBackgroundColor: "#ffffff",
  theme: "light",
  gridSize: null,
  snapToObjects: true,
  currentStyle: {
    strokeColor: "#1e1e1e",
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
