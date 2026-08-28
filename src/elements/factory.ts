import { nanoid } from "nanoid";
import type {
  AppState,
  EmbedElement,
  ExcaliElement,
  FrameElement,
  FreedrawElement,
  GenericElement,
  ImageElement,
  LinearElement,
  TextElement,
} from "../types";
import { LINE_HEIGHT } from "../constants";

let frameCounter = 0;

const baseFrom = (state: AppState, x: number, y: number) => {
  const s = state.currentStyle;
  return {
    id: nanoid(),
    x,
    y,
    width: 0,
    height: 0,
    angle: 0,
    seed: Math.floor(Math.random() * 2 ** 31),
    version: 1,
    groupIds: [],
    frameId: null,
    locked: false,
    isDeleted: false,
    link: null,
    strokeColor: s.strokeColor,
    backgroundColor: s.backgroundColor,
    textColor: s.textColor ?? s.strokeColor,
    fillStyle: s.fillStyle,
    strokeWidth: s.strokeWidth,
    strokeStyle: s.strokeStyle,
    roughness: s.roughness,
    edges: s.edges,
    opacity: s.opacity,
  };
};

export const newGenericElement = (
  type: GenericElement["type"],
  state: AppState,
  x: number,
  y: number,
): GenericElement => ({
  ...baseFrom(state, x, y),
  type,
  boundText: null,
  boundArrows: [],
});

export const newLinearElement = (
  type: LinearElement["type"],
  state: AppState,
  x: number,
  y: number,
): LinearElement => ({
  ...baseFrom(state, x, y),
  type,
  points: [[0, 0]],
  startArrowhead: type === "arrow" ? state.currentStyle.startArrowhead : "none",
  endArrowhead: type === "arrow" ? state.currentStyle.endArrowhead : "none",
  pathType: state.currentStyle.pathType,
  startBinding: null,
  endBinding: null,
  boundText: null,
  boundArrows: [],
});

export const newFreedrawElement = (
  state: AppState,
  x: number,
  y: number,
): FreedrawElement => ({
  ...baseFrom(state, x, y),
  type: "freedraw",
  points: [[0, 0]],
  pressures: [0.5],
  // freehand strokes are filled paths, so the shape fill must not apply
  backgroundColor: "transparent",
  roughness: 0,
});

export const newTextElement = (
  state: AppState,
  x: number,
  y: number,
  containerId: string | null = null,
): TextElement => ({
  ...baseFrom(state, x, y),
  type: "text",
  text: "",
  fontSize: state.currentStyle.fontSize,
  fontFamily: state.currentStyle.fontFamily,
  textAlign: containerId ? "center" : state.currentStyle.textAlign,
  verticalAlign: containerId ? "middle" : "top",
  containerId,
  lineHeight: LINE_HEIGHT,
  backgroundColor: "transparent",
});

export const newImageElement = (
  state: AppState,
  x: number,
  y: number,
  fileId: string,
  width: number,
  height: number,
): ImageElement => ({
  ...baseFrom(state, x, y),
  type: "image",
  fileId,
  width,
  height,
  crop: null,
  backgroundColor: "transparent",
  roughness: 0,
});

export const newFrameElement = (
  state: AppState,
  x: number,
  y: number,
): FrameElement => ({
  ...baseFrom(state, x, y),
  type: "frame",
  name: `Frame ${++frameCounter}`,
  strokeColor: "#bbb",
  backgroundColor: "transparent",
  roughness: 0,
  edges: "sharp",
});

export const newEmbedElement = (
  state: AppState,
  x: number,
  y: number,
  url: string,
): EmbedElement => ({
  ...baseFrom(state, x, y),
  type: "embed",
  url,
  roughness: 0,
  backgroundColor: "transparent",
});

/** Deep-copies an element under a fresh id, keeping every other property. */
export const duplicateElement = <T extends ExcaliElement>(el: T, dx = 0, dy = 0): T =>
  ({
    ...structuredClone(el),
    id: nanoid(),
    x: el.x + dx,
    y: el.y + dy,
    seed: Math.floor(Math.random() * 2 ** 31),
    version: 1,
  }) as T;

/** Restarts frame numbering so a freshly opened scene doesn't keep counting up. */
export const syncFrameCounter = (elements: ExcaliElement[]) => {
  frameCounter = elements.filter((el) => el.type === "frame").length;
};
