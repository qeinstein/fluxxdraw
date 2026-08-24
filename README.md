# Excalidraw-style whiteboard — files-first, no backend

A hand-drawn-style infinite canvas that runs entirely in the browser. There is
no server, no account, and no cloud storage: your drawings are files on your
own disk, the way a text editor works. Save one, close the tab, open it again
later, keep drawing.

## The file model

Every export can also *be* the source file:

| Format | Extension | Re-openable | Notes |
| --- | --- | --- | --- |
| Drawing | `.excali` | yes | Plain JSON. The canonical save format. |
| PNG | `.png` | yes | Scene JSON is embedded in a `tEXt` chunk. |
| SVG | `.svg` | yes | Scene JSON is embedded in a `<metadata>` element. |
| JPEG | `.jpg` | no | Flat image; no transparency. |
| WebP | `.webp` | no | Flat image. |

Drop any of them onto the canvas — or use **Open** (`⌘O`) — and a file carrying
an embedded scene reopens as a fully editable drawing. A plain image is placed
on the canvas instead.

### Resolution

Raster exports offer `1×`, `2×`, `3×`, **4K**, **8K**, and a custom multiplier.
The 4K/8K presets scale the drawing so its *longest side* is exactly 3840 or
7680 px, and the dialog shows the exact pixel output before you commit. Very
large exports are clamped to the browser's maximum canvas dimension, and the
dialog says so when that happens.

### Where exports go

Pick a folder once (**Export → Save to → Choose a folder…**) and every later
export is written straight into it — no download prompts. The folder handle is
persisted in IndexedDB, so it survives a refresh, and you can change or clear it
at any time from the same place.

This uses the File System Access API, which today means a Chromium browser
(Chrome, Edge, Arc, Brave). On Firefox and Safari the app falls back to ordinary
downloads automatically; everything else works identically.

`⌘S` saves over the file you opened. `⇧⌘S` is Save as. A local autosave in
`localStorage` restores your last session after a refresh or crash, but your
files remain the source of truth.

## What's on the canvas

**Tools** — selection, hand/pan, rectangle, diamond, ellipse, arrow, line,
freehand draw, text, image, frame, embed, eraser, laser pointer.

**Per-element styling** — stroke colour, background fill, fill style
(hachure / cross-hatch / solid / zigzag), stroke width, stroke style
(solid / dashed / dotted), sloppiness (Architect / Artist / Cartoonist), sharp
or round edges, opacity, and independent start/end arrowheads (none, arrow,
triangle, triangle outline, bar, dot).

**Arrows** — bind to shapes at both ends and follow them when the shapes move,
resize or rotate. Multi-point routing (click, click, click… then `Esc`), curved
or angular segments, and an elbowed mode that routes at 90°.

**Text** — standalone, or bound as a label inside any shape (double-click it).
Labels wrap to the container and grow it when needed. Three font families,
four sizes, three alignments.

**Editing** — multi-select by shift-click or marquee, move, resize from eight
handles, rotate (hold `⇧` to snap to 15°), group/ungroup, lock, z-order, align
and distribute, duplicate by `⌘D` or Alt-drag, and full undo/redo.

**Canvas** — infinite pan and zoom (zoom at the cursor with `⌘`+scroll),
optional grid with grid snapping, object snapping with alignment guides, frames
that group elements and scope exports, light/dark theme, and a custom canvas
background colour.

Press `?` in the app for the full shortcut list.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
npm run smoke    # browser end-to-end checks (needs the dev server running)
```

`npm run smoke` drives a real Chromium instance: it draws every element type,
verifies arrow binding, container labels, undo/redo and grouping, exports in all
five formats, and asserts that PNG, SVG and `.excali` exports all round-trip
back into an identical editable scene.

## How it's put together

```
src/
  types.ts            element and scene type model
  store.ts            immutable scene store + undo/redo history
  actions.ts          scene-level operations (grouping, align, z-order, bindings)
  geometry.ts         bounds, rotation, distance helpers
  elements/           element factories, text layout, hit testing, arrow binding
  interaction/        resize/rotate maths, snapping
  render/             rough.js drawable generation, canvas renderer, image cache
  io/                 serialisation, PNG/SVG/raster export, File System Access, preferences
  components/         canvas, toolbar, style panel, dialogs
```

The renderer builds [rough.js](https://roughjs.com) drawables once per element
version and caches them, then draws them through either a canvas or an SVG
backend — which is why an SVG export looks identical to what's on screen.
Freehand strokes use [perfect-freehand](https://github.com/steveruizok/perfect-freehand).

Scene state lives outside React so pointer handlers can mutate at pointer-move
rate; components subscribe through `useSyncExternalStore`.
