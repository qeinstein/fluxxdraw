import { IconClose } from "./icons";

const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: "Tools",
    items: [
      ["Selection", "1 / V"],
      ["Rectangle", "2 / R"],
      ["Diamond", "3 / D"],
      ["Ellipse", "4 / O"],
      ["Arrow", "5 / A"],
      ["Line", "6 / L"],
      ["Draw", "7 / P"],
      ["Text", "8 / T"],
      ["Image", "9"],
      ["Frame", "F"],
      ["Eraser", "0 / E"],
      ["Laser pointer", "K"],
      ["Hand (pan)", "H / hold Space"],
      ["Keep tool active", "Q"],
    ],
  },
  {
    title: "Edit",
    items: [
      ["Undo", "⌘Z"],
      ["Redo", "⇧⌘Z"],
      ["Duplicate", "⌘D or Alt-drag"],
      ["Delete", "Delete / Backspace"],
      ["Select all", "⌘A"],
      ["Group", "⌘G"],
      ["Ungroup", "⇧⌘G"],
      ["Lock / unlock", "⇧⌘L"],
      ["Bring to front", "⌘]"],
      ["Send to back", "⌘["],
      ["Nudge", "Arrow keys"],
      ["Nudge further", "⇧ + arrows"],
      ["Tidy up layout", "⇧⌘T"],
    ],
  },
  {
    title: "View",
    items: [
      ["Zoom in / out", "⌘+ / ⌘−"],
      ["Reset zoom", "⌘0"],
      ["Zoom to fit", "⇧1"],
      ["Pan", "Space-drag, middle-drag, or scroll"],
      ["Zoom at cursor", "⌘ + scroll"],
    ],
  },
  {
    title: "Files",
    items: [
      ["Open", "⌘O"],
      ["Save", "⌘S"],
      ["Save as", "⇧⌘S"],
      ["Export", "⇧⌘E"],
      ["Version history", "⌘H"],
      ["Present frames", "⇧⌘P"],
      ["Paste image / open file", "⌘V or drag onto canvas"],
    ],
  },
  {
    title: "While drawing",
    items: [
      ["Constrain to square / circle", "Hold ⇧"],
      ["Snap line to 15°", "Hold ⇧"],
      ["Multi-point line", "Click, click, click… then Esc"],
      ["Add a point to a line", "Double-click the line"],
      ["Edit / add a shape label", "Double-click the shape"],
      ["Ignore object snapping", "Hold ⌘ while dragging"],
    ],
  },
];

export const HelpDialog = ({ onClose }: { onClose: () => void }) => (
  <div className="dialog-backdrop" onClick={onClose}>
    <div className="dialog wide" onClick={(e) => e.stopPropagation()}>
      <header>
        <h2>Keyboard shortcuts</h2>
        <button className="icon-button" aria-label="Close" onClick={onClose}>
          <IconClose />
        </button>
      </header>
      <div className="dialog-body shortcut-grid">
        {GROUPS.map((group) => (
          <section key={group.title}>
            <h3>{group.title}</h3>
            {group.items.map(([label, keys]) => (
              <div className="shortcut-row" key={label}>
                <span>{label}</span>
                <kbd>{keys}</kbd>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  </div>
);
