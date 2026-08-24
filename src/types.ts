import type { Checkpoint } from "./io/history";

export type FillStyle = "hachure" | "cross-hatch" | "solid" | "zigzag";
export type StrokeStyle = "solid" | "dashed" | "dotted";
export type Edges = "sharp" | "round";
export type Arrowhead = "none" | "arrow" | "triangle" | "triangle-outline" | "bar" | "dot";
export type FontFamily =
  | "hand"
  | "casual"
  | "marker"
  | "neat"
  | "normal"
  | "code";
export type TextAlign = "left" | "center" | "right";
export type VerticalAlign = "top" | "middle" | "bottom";

/** Style properties shared by every element. */
export interface ElementStyle {
  strokeColor: string;
  backgroundColor: string;
  fillStyle: FillStyle;
  strokeWidth: number;
  strokeStyle: StrokeStyle;
  /** 0 = architect, 1 = artist, 2 = cartoonist */
  roughness: number;
  edges: Edges;
  /** 0-100 */
  opacity: number;
}

interface BaseElement extends ElementStyle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  angle: number;
  seed: number;
  /** bumped on every mutation; used to invalidate the render cache */
  version: number;
  groupIds: string[];
  frameId: string | null;
  locked: boolean;
  isDeleted: boolean;
  link: string | null;
}

export interface GenericElement extends BaseElement {
  type: "rectangle" | "diamond" | "ellipse";
  /** id of a text element rendered as this shape's label */
  boundText: string | null;
  /** ids of arrows bound to this shape */
  boundArrows: string[];
}

export interface LinearElement extends BaseElement {
  type: "arrow" | "line";
  /** points relative to (x, y); always starts at [0, 0] */
  points: [number, number][];
  startArrowhead: Arrowhead;
  endArrowhead: Arrowhead;
  /** route with orthogonal segments instead of straight/curved ones */
  elbowed: boolean;
  startBinding: Binding | null;
  endBinding: Binding | null;
  boundText: string | null;
  boundArrows: string[];
}

export interface Binding {
  elementId: string;
  /** how far along the shape's edge the arrow aims, -1..1 */
  focus: number;
  /** distance kept between the arrow tip and the shape outline */
  gap: number;
}

export interface FreedrawElement extends BaseElement {
  type: "freedraw";
  points: [number, number][];
  pressures: number[];
}

export interface TextElement extends BaseElement {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: FontFamily;
  textAlign: TextAlign;
  verticalAlign: VerticalAlign;
  /** id of the shape/arrow this text labels, if any */
  containerId: string | null;
  lineHeight: number;
}

export interface ImageElement extends BaseElement {
  type: "image";
  fileId: string;
  /** normalized 0..1 crop window into the source bitmap */
  crop: { x: number; y: number; w: number; h: number } | null;
}

export interface FrameElement extends BaseElement {
  type: "frame";
  name: string;
}

export interface EmbedElement extends BaseElement {
  type: "embed";
  url: string;
}

export type ExcaliElement =
  | GenericElement
  | LinearElement
  | FreedrawElement
  | TextElement
  | ImageElement
  | FrameElement
  | EmbedElement;

export type ElementType = ExcaliElement["type"];

/** Any element that can hold a bound text label and accept arrow bindings. */
export type BindableElement = GenericElement | FrameElement | ImageElement | TextElement;

export interface BinaryFile {
  id: string;
  mimeType: string;
  /** data URL */
  dataURL: string;
  created: number;
}

export type Tool =
  | "selection"
  | "hand"
  | "rectangle"
  | "diamond"
  | "ellipse"
  | "arrow"
  | "line"
  | "freedraw"
  | "text"
  | "image"
  | "frame"
  | "embed"
  | "eraser"
  | "laser";

export interface AppState {
  tool: Tool;
  /** keep the active tool selected after drawing instead of reverting to selection */
  toolLocked: boolean;
  selectedIds: string[];
  editingTextId: string | null;
  scrollX: number;
  scrollY: number;
  zoom: number;
  viewBackgroundColor: string;
  theme: "light" | "dark";
  gridSize: number | null;
  snapToObjects: boolean;
  /** style applied to the next element drawn */
  currentStyle: ElementStyle & {
    fontSize: number;
    fontFamily: FontFamily;
    textAlign: TextAlign;
    startArrowhead: Arrowhead;
    endArrowhead: Arrowhead;
    elbowed: boolean;
  };
}

export interface Scene {
  elements: ExcaliElement[];
  files: Record<string, BinaryFile>;
}

/** On-disk `.fluxx` / `.json` document. */
export interface SceneDocument {
  type: "fluxxdraw";
  version: number;
  source: string;
  elements: ExcaliElement[];
  files: Record<string, BinaryFile>;
  appState: {
    viewBackgroundColor: string;
    gridSize: number | null;
    theme: "light" | "dark";
  };
  /** durable version history travelling with the document */
  history?: Checkpoint[];
}

export const FILE_VERSION = 1;
export const FILE_SOURCE = "fluxxdraw";
export const DOCUMENT_TYPE = "fluxxdraw";
/** Document types we can read in addition to our own. */
export const COMPATIBLE_DOCUMENT_TYPES = ["fluxxdraw", "excalidraw"];
