# Changelog

Versions follow [semantic versioning](https://semver.org) as it applies to an
app rather than a library: the minor number moves when features land, the patch
number when only fixes do, and the major number if a `.fluxx` file written by a
new version stops opening in an old one.

## Unreleased

## v1.1.1

- Automated GitHub Releases via Actions

## v1.1.0

### Collaboration

- Added serverless peer-to-peer real-time collaboration using Yjs and WebRTC
- Generate shareable links to invite others to edit the same drawing
- View remote participants' avatars and their live cursor movements
- Persistent local drafts using IndexedDB

### Workspace

- Added a searchable layer navigator that selects and focuses objects directly
- Added local canvas comments with visible pins attached to diagram elements
- Added a recent-document screen backed by local editable scene snapshots
- Added rotating crash-recovery snapshots with direct restore and deletion
- Added named reusable style presets in the style inspector

### Interface and libraries

- Added a compact contextual selection toolbar and collapsible style sections
- Refined floating chrome, notes, library cards, feedback states and motion
- Fixed community library installation, persistence, placement, payload parsing,
  multi-component installed state and server-side database routing
- Prioritized software architecture, system-design and infrastructure component
  packs at the top of community library results
- Made default strokes theme-aware: black on light canvases and white in dark mode
- Merged keyboard shortcuts into a two-view Command-K palette and removed the
  redundant floating shortcuts control
- Added direct comment popovers and quick comment creation beside selections
- Simplified the top-right action island, library navigation and provider tabs,
  tightened sidebar spacing, and shifted the toolbar around a docked library

## v1.0.0

First public release. Everything below is in the `v1.0.0` tag.

### Drawing

- Rectangles, diamonds, ellipses, arrows, lines, freehand, text, images and
  frames, drawn in a hand-drawn style with configurable sloppiness
- Sticky notes on `N` — a filled square with a centred label, placed and typed
  into in one click
- Labels bound inside shapes, arrows that stay bound to what they connect,
  multi-point lines, and object snapping with alignment guides
- Reusable components: turn a selection into a master, place instances, edit the
  master to update every copy, and style instances individually
- Grouping, alignment, distribution, layer order and locking

### Diagramming

- AWS, Google Cloud and Azure service presets — 68 services, searchable, placed
  as ordinary components that connect and resize like anything else
- A bidirectional text view: edit the diagram or edit the text, and they stay in
  step
- Automatic layout for connected diagrams
- Links from one object to another, so a board becomes navigable; the link is a
  plain URL that opens the file on that element
- Frames, and a presentation mode that walks through them
- Laser pointer for talking over a diagram

### Files

- `.fluxx` documents, plus `.excalidraw` and Excalidraw scene-carrying PNGs
- Exports to PNG, JPEG, WebP and SVG at up to 8K, optionally carrying the scene
  so an export reopens as an editable drawing
- A chosen export folder, quick save, and OS file association once installed
- In-file version history with a scrubbable timeline
- Autosave for crash recovery; the file on disk stays the real copy

### Interface

- Works on phones and tablets: tools dock within thumb reach, style controls
  move into a sheet, long-press opens the context menu, pinch to zoom
- Keyboard shortcuts labelled for the platform you're on — ⌘ on a Mac, Ctrl
  everywhere else — from one table shared with the handler that runs them
- Right-click, or long-press, for actions on whatever is under the pointer
- Light and dark themes, six drawing fonts embedded into SVG exports

### Privacy

- Drawings never leave the machine. No account, no cloud, no backend
- Optional aggregate usage counters at `/uqnautmfluxx`: event totals and a
  concurrent-session count, no identifiers and nothing about any drawing
