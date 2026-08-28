<div align="center">
  <br />
  <h1>FluxxDraw</h1>
  <p><strong>A fast, real-time collaborative whiteboard and diagramming application.</strong></p>
  
  <p>
    <a href="https://fluxxdraw.cv"><img alt="Website" src="https://img.shields.io/badge/Website-fluxxdraw.cv-blue?style=flat-square&logo=vercel" /></a>
    <a href="https://github.com/qeinstein/fluxxdraw/blob/main/LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/License-MIT-green.svg?style=flat-square" /></a>
    <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white" />
    <img alt="Vite" src="https://img.shields.io/badge/Vite-646CFF?style=flat-square&logo=vite&logoColor=white" />
  </p>
</div>

<hr/>

FluxxDraw is a real-time collaborative diagramming application used by ~1,000 daily visitors. It combines a robust local-first document architecture with seamless multiplayer capabilities through Yjs/WebSockets. Because everything is stored locally on your own machine and syncs directly between peers, your data stays yours without relying on cloud storage or accounts.

## Key Features

### True real-time collaboration
Work together with others in real-time. The application utilizes a full collaboration layer powered by Yjs and WebSockets to sync canvas updates instantly and conflict-free across clients, rather than a mocked collaboration UI.

### Your drawings as real files
Every drawing is a `.fluxx` file on your disk, opened and saved like a normal document. Nothing lives in a browser tab you're afraid to close. PNG and SVG exports carry the whole editable scene inside them — drop an exported PNG back onto the canvas and you're editing it again.

### Version history that belongs to you
Every drawing carries its own past. Checkpoints are recorded as you work and written into the file itself. Press `⌘H` to scrub through history, play it back, or restore an old version. Even an exported PNG carries its history.

### Bidirectional diagram/text synchronization
Press `⌘/` to open a text view beside the canvas. The two stay in sync in both directions. Type `api -> db: queries` and the boxes appear automatically. Drag a box on the canvas, and the textual representation rewrites itself to match the new visual state.

### Diagrams that tidy themselves
Press `⇧⌘T` to take a scattered mess of boxes and arrows and lay it out properly — layered, evenly spaced, and re-routed — without losing the hand-drawn look.

### Presentations for free
Frames act as slides. Press `⇧⌘P` to go full screen and step through them with the arrow keys. The UI fades away, leaving just you and a laser pointer for presenting.

### Shapes that are actually reusable
A component is a real instance. Edit the master component once, and every placed copy updates instantly. Detach one, and it becomes ordinary shapes again.

### Consistent handwriting everywhere
Six drawing fonts are bundled with the app. SVG exports inline the fonts they use, ensuring your diagram looks identical on a computer that has never seen it.

---

## Getting Started

To run FluxxDraw locally on your machine:

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
# App will be running at http://localhost:5173
```

### Additional Commands

```bash
npm run collab:server # Start an optional local Yjs relay on ws://127.0.0.1:1234
npm run build         # Create a production build into dist/
npm run smoke         # Run end-to-end checks against a running dev server
```

## Architecture

FluxxDraw features a robust, performance-oriented architecture with clear separation of concerns across elements, interaction, rendering, I/O, DSL, components, workspace state, and persistence:

- **Performance-Oriented Rendering:** Scene state lives outside React so pointer handlers can avoid unnecessary React churn and mutate at pointer-move rate; components selectively subscribe through `useSyncExternalStore`. The renderer builds [rough.js](https://roughjs.com) drawables once per element version and caches them, then draws them through either a canvas or an SVG backend. Freehand strokes use [perfect-freehand](https://github.com/steveruizok/perfect-freehand).
- **Real-Time Collaboration:** A true multi-user layer built on `yjs` and `y-websocket` provides conflict-free state synchronization across clients. Development defaults to `ws://127.0.0.1:1234`; set `VITE_YJS_RELAY_URL` for a different deployment.
- **Local-First Persistence:** Documents are entirely local, allowing offline work with embedded version history in `.fluxx` files, backed by `y-indexeddb`.
- **Privacy-Conscious Analytics:** A custom, privacy-respecting analytics implementation (in `src/analytics.ts`) tracks sessions and events to understand usage (~1,000 daily visitors) without ever transmitting drawing contents or personally identifiable identifiers.

## Contributing

Contributions are welcome. FluxxDraw is MIT licensed, so you can use it, fork it, embed it in something else, or ship it commercially without asking. 

If you're fixing a bug, a failing check in `scripts/` that turns green is the most convincing thing you can bring. If you're adding a feature, open an issue first so we can agree it belongs here before you spend time on it.

---

<div align="center">
  <i>FluxxDraw is an independent project written from scratch and is not affiliated with Excalidraw, though it deliberately keeps the tools and shortcuts familiar. It will happily open <code>.excalidraw</code> files.</i>
</div>
