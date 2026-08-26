# FluxxDraw

I built FluxxDraw to satisfy cravings that Excalidraw could never quite get me. I love Excalidraw — the hand-drawn look, the speed, the way it gets out of your way. But every time I leaned on it properly, I ran into the same wall: the things I actually wanted next were either behind Excalidraw+ or simply weren't there. Version history costs money because it lives on someone else's server. Presentations cost money. My drawings lived in a browser tab I was quietly afraid of clearing. Duplicating a shape twenty times meant twenty things to fix by hand when the design changed. And a diagram I'd spent an hour on still looked like a mess unless I nudged every box into place myself.

So this is that whiteboard, built the way I wanted it. It runs entirely in your browser. There is no backend, no account, and no cloud storage, which is exactly what makes the rest of it possible: anything that runs on your own machine can be free forever, and it turns out that covers almost everything I was missing.

## What I wanted that I couldn't get

**My drawings as real files.** Every drawing is a `.fluxx` file on your disk, opened and saved like a text document. Nothing lives in a tab I'm scared to close. Better still, PNG and SVG exports carry the whole scene inside them — a `tEXt` chunk in the PNG, a `<metadata>` element in the SVG — so the flat image you send someone is also the editable source. Drop an exported PNG back onto the canvas and you're editing it again.

**Version history that belongs to me.** Every drawing carries its own past. Checkpoints are recorded as you work, delta-encoded against periodic keyframes, and written into the file itself, so history travels with the document instead of living on a server. Press `⌘H` to scrub through it, play it back, or see what changed at each step. Scrubbing only ever previews — the present is handed back untouched when you close it — and restoring an old version is itself undoable. An exported PNG carries its history too, which still feels slightly absurd to me.

**Exports at a resolution I choose.** PNG, JPEG, WebP, SVG and `.fluxx`, at 1×, 2×, 3×, 4K, 8K, or any multiplier you like. The 4K and 8K presets scale the drawing so its longest edge lands exactly on 3840 or 7680 pixels, and the dialog tells you the precise pixel size before you commit.

**Presentations without paying for them.** Frames are slides. `⇧⌘P` goes full screen and steps through them with the arrow keys, letter-boxing each frame to the display and clipping to its bounds. The chrome fades away until you point at it, and the laser pointer is there for talking over a diagram.

**A diagram I can write as well as draw.** `⌘/` opens a text view of the diagram beside the canvas, and the two stay in sync in both directions. Type `api -> db: queries` and the boxes appear, laid out properly. Drag a box or rename a label on the canvas and the text rewrites itself to match. Excalidraw's Mermaid support converts once and forgets; this round-trips, which means a diagram becomes something you can diff, review in a pull request, and edit from whichever side suits the moment. Anything the text cannot express — freehand strokes, images, frames — is left strictly alone.

**Diagrams that tidy themselves.** `⇧⌘T` takes a scattered mess of boxes and arrows and lays it out properly — layered, evenly spaced, arrows re-routed onto their shapes — without losing the hand-drawn look. Shapes with no connections get parked on a neat grid below. It's one undo step if you hate the result.

**Shapes that are actually reusable.** Excalidraw's libraries hand you copies; change your mind and you're editing every copy by hand. Here a component is a real instance. Edit the master once and every placed copy updates. Detach one and it becomes ordinary shapes again.

**Text that doesn't fight me.** The editor grows as you type — outwards for free text, wrapping downwards for a label inside a shape — and the canvas and the editor share one baseline calculation, so nothing jumps when you finish typing.

**Handwriting that looks the same everywhere.** Six drawing fonts are bundled with the app rather than borrowed from whatever your machine happens to have, and SVG exports inline the fonts they use, so a drawing looks identical on a computer that has never seen it.


## The rest of the canvas

Everything you'd expect from Excalidraw is here and behaves the way you already know: rectangles, diamonds, ellipses, arrows, lines, freehand drawing, text, images, frames, embedded links, an eraser and a laser pointer. Arrows bind to shapes and follow them when they move, resize or rotate, with multi-point routing and an elbowed mode. Shapes take labels on a double-click. There's multi-select, resizing from eight handles, rotation snapping, grouping, locking, z-ordering, alignment and distribution, object snapping with guides, an optional grid, and full undo/redo.

Navigation works like an infinite canvas should: pinch to zoom on a trackpad or touchscreen, two-finger scroll to pan, space-drag or middle-drag to pan with a mouse, and `⌘`+scroll to zoom about the cursor. Press `?` in the app for the full list of shortcuts.

## Opening a .fluxx file from your desktop

Install FluxxDraw as an app — in Chrome or Edge, the install button in the address bar — and the operating system registers `.fluxx` as a FluxxDraw document. Double-clicking one opens it straight in the app through the web File Handling API. This needs the app to be installed, because a plain browser tab cannot claim a file type, and it is Chromium-only for now. Drag-and-drop and the Open dialog work everywhere regardless.

## A note on browser support

Choosing a specific export folder and opening files by double-click both rely on the File System Access API, which today means a Chromium browser. On Firefox and Safari the app falls back to ordinary downloads and the file picker, and everything else — drawing, history, presentations, components, exports — works identically. This is a browser limitation rather than a design choice, and there is no way around it without the backend I deliberately don't have.

## Running it

```bash
npm install
npm run dev      # http://localhost:5173
npm run collab:server # optional local Yjs relay on ws://127.0.0.1:1234
npm run build    # production build into dist/
npm run smoke    # end-to-end checks against a running dev server
```

Collaboration uses a Yjs WebSocket relay. Development defaults to
`ws://127.0.0.1:1234`; set `VITE_YJS_RELAY_URL` for a different deployment.
The bundled relay is local-only and holds documents in memory.

The test scripts under `scripts/` drive a real Chromium instance rather than mocking the DOM: they draw every element type, verify arrow binding, text growth, history round-trips, layout, components, presentations and gestures, and assert that PNG, SVG and `.fluxx` exports all reopen as identical editable scenes.

## How it fits together

Scene state lives outside React so pointer handlers can mutate at pointer-move rate; components subscribe through `useSyncExternalStore`. The renderer builds [rough.js](https://roughjs.com) drawables once per element version and caches them, then draws them through either a canvas or an SVG backend, which is why an SVG export looks exactly like what's on screen. Freehand strokes use [perfect-freehand](https://github.com/steveruizok/perfect-freehand).

```
src/
  types.ts            element and scene type model
  store.ts            immutable scene store, undo/redo, timeline
  actions.ts          scene operations: grouping, align, z-order, bindings
  layout.ts           graph layout for tidy up
  components-model.ts component definitions and instances
  theme.ts            light/dark switching with palette re-mapping
  fonts.ts            the bundled drawing fonts
  geometry.ts         bounds, rotation, distance helpers
  elements/           factories, text layout, hit testing, arrow binding
  interaction/        resize and rotate maths, snapping
  render/             drawable generation, canvas renderer, laser, image cache
  io/                 serialisation, exports, history, File System Access
  components/         canvas, toolbar, panels, dialogs
```

## Writing a diagram as text

The syntax is line-based and deliberately small. A node is a name, optionally a
label after a colon, optionally a shape in brackets and a fill in braces. An
edge is two names joined by an arrow, optionally with a label.

```
# a comment
api: API Gateway
db: Postgres [ellipse] {blue}
cache: Redis [diamond]

api -> db: queries     # a solid arrow
api --> cache          # dashed
db -- cache            # a plain line, no arrowhead
```

Shapes are `rectangle`, `ellipse` and `diamond`. Fills are `red`, `green`,
`blue`, `yellow`, `grey`, or any hex value. Nodes mentioned in an edge but never
declared are created for you. Mistakes are reported with a line number rather
than throwing the diagram away.

## Usage figures

`/uqnautmfluxx` shows how the app is being used: sessions open now, visits per
day, and which cloud services get placed most. It needs a Redis store connected
to the project — Upstash's free tier is enough — which supplies either
`KV_REST_API_URL`/`KV_REST_API_TOKEN` or the `UPSTASH_REDIS_REST_*` pair; both
are accepted. Environment variables only reach the functions at build time, so
redeploy after connecting the store.

Counters only: an event name, a service id, and a per-tab token that expires in
minutes. No identifiers, no cookies, and nothing about anyone's drawings. Do Not
Track is honoured and localhost is never counted. Set `STATS_TOKEN` to require
`/uqnautmfluxx#k=<token>` if the page shouldn't be readable by anyone who finds
the URL.

## Contributing

Contributions are welcome. FluxxDraw is MIT licensed, so you can use it, fork it, embed it in something else, or ship it commercially without asking. If you're fixing a bug, a failing check in `scripts/` that turns green is the most convincing thing you can bring. If you're adding a feature, open an issue first so we can agree it belongs here before you spend the evening on it.

FluxxDraw is not affiliated with Excalidraw. It was written from scratch, though it deliberately keeps Excalidraw's tools and shortcuts familiar, and it will happily open `.excalidraw` files and Excalidraw's scene-carrying PNGs.
