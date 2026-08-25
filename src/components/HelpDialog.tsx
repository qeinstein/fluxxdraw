import { IconClose } from "./icons";
import { KEY, formatCombo, sc } from "../shortcuts";

/**
 * Every combo here comes from the shortcuts table, so this sheet can't drift
 * out of step with what the app actually listens for.
 */
const Kbd = ({ children }: { children: React.ReactNode }) => <kbd>{children}</kbd>;

export const SHORTCUT_GROUPS: { title: string; items: { label: string; shortcut: React.ReactNode }[] }[] = [
  {
    title: "Tools",
    items: [
      { label: "Selection", shortcut: <><Kbd>1</Kbd> / <Kbd>V</Kbd></> },
      { label: "Rectangle", shortcut: <><Kbd>2</Kbd> / <Kbd>R</Kbd> / <Kbd>S</Kbd></> },
      { label: "Sticky note", shortcut: <Kbd>N</Kbd> },
      { label: "Diamond", shortcut: <><Kbd>3</Kbd> / <Kbd>D</Kbd></> },
      { label: "Ellipse", shortcut: <><Kbd>4</Kbd> / <Kbd>O</Kbd></> },
      { label: "Arrow", shortcut: <><Kbd>5</Kbd> / <Kbd>A</Kbd></> },
      { label: "Line", shortcut: <><Kbd>6</Kbd> / <Kbd>L</Kbd></> },
      { label: "Draw", shortcut: <><Kbd>7</Kbd> / <Kbd>P</Kbd></> },
      { label: "Text", shortcut: <><Kbd>8</Kbd> / <Kbd>T</Kbd></> },
      { label: "Image", shortcut: <Kbd>9</Kbd> },
      { label: "Frame", shortcut: <Kbd>F</Kbd> },
      { label: "Eraser", shortcut: <><Kbd>0</Kbd> / <Kbd>E</Kbd></> },
      { label: "Laser pointer", shortcut: <Kbd>K</Kbd> },
      { label: "Hand (pan)", shortcut: <><Kbd>H</Kbd> / hold <Kbd>Space</Kbd></> },
    ],
  },
  {
    title: "Edit",
    items: [
      { label: "Undo", shortcut: <Kbd>{sc("undo")}</Kbd> },
      { label: "Redo", shortcut: <><Kbd>{sc("redo")}</Kbd> / <Kbd>{sc("redoAlt")}</Kbd></> },
      { label: "Duplicate", shortcut: <><Kbd>{sc("duplicate")}</Kbd> or <Kbd>{KEY.alt}</Kbd>-drag</> },
      { label: "Delete", shortcut: <><Kbd>Delete</Kbd> / <Kbd>Backspace</Kbd></> },
      { label: "Select all", shortcut: <Kbd>{sc("selectAll")}</Kbd> },
      { label: "Group", shortcut: <Kbd>{sc("group")}</Kbd> },
      { label: "Ungroup", shortcut: <Kbd>{sc("ungroup")}</Kbd> },
      { label: "Lock / unlock", shortcut: <Kbd>{sc("lock")}</Kbd> },
      { label: "Bring to front / forward", shortcut: <><Kbd>{sc("bringToFront")}</Kbd> / <Kbd>{sc("bringForward")}</Kbd></> },
      { label: "Send to back / backward", shortcut: <><Kbd>{sc("sendToBack")}</Kbd> / <Kbd>{sc("sendBackward")}</Kbd></> },
      { label: "Nudge", shortcut: <Kbd>Arrow keys</Kbd> },
      { label: "Nudge further", shortcut: <><Kbd>{KEY.shift}</Kbd> + <Kbd>Arrow keys</Kbd></> },
      { label: "Tidy up layout", shortcut: <Kbd>{sc("tidyUp")}</Kbd> },
      { label: "Actions for what's under the cursor", shortcut: <>Right-click / long-press</> },
      { label: "Link one object to another", shortcut: <>Right-click → Copy link, then Add link</> },
      { label: "Follow a link", shortcut: <>Click the badge above the object</> },
    ],
  },
  {
    title: "View",
    items: [
      { label: "Zoom in / out", shortcut: <><Kbd>{sc("zoomIn")}</Kbd> / <Kbd>{sc("zoomOut")}</Kbd></> },
      { label: "Reset zoom", shortcut: <Kbd>{sc("zoomReset")}</Kbd> },
      { label: "Zoom to fit", shortcut: <Kbd>{sc("zoomToFit")}</Kbd> },
      { label: "Pan", shortcut: <>Space-drag, middle-drag, or scroll</> },
      { label: "Zoom at cursor", shortcut: <><Kbd>{KEY.mod}</Kbd> + scroll</> },
    ],
  },
  {
    title: "Files",
    items: [
      { label: "Open", shortcut: <Kbd>{sc("open")}</Kbd> },
      { label: "Save", shortcut: <Kbd>{sc("save")}</Kbd> },
      { label: "Save as", shortcut: <Kbd>{sc("saveAs")}</Kbd> },
      { label: "Export", shortcut: <Kbd>{sc("export")}</Kbd> },
      { label: "Version history", shortcut: <Kbd>{sc("history")}</Kbd> },
      { label: "Present frames", shortcut: <Kbd>{sc("present")}</Kbd> },
      { label: "Diagram as text", shortcut: <Kbd>{sc("diagramText")}</Kbd> },
      { label: "Service library", shortcut: <Kbd>{sc("services")}</Kbd> },
      { label: "Paste image / open file", shortcut: <><Kbd>{formatCombo("mod+v")}</Kbd> or drag onto canvas</> },
    ],
  },
  {
    title: "While drawing",
    items: [
      { label: "Constrain to square / circle", shortcut: <>Hold <Kbd>{KEY.shift}</Kbd></> },
      { label: "Snap line to 15°", shortcut: <>Hold <Kbd>{KEY.shift}</Kbd></> },
      { label: "Multi-point line", shortcut: <>Click, click, click… then <Kbd>Esc</Kbd></> },
      { label: "Add a point to a line", shortcut: <>Double-click the line</> },
      { label: "Edit / add a shape label", shortcut: <>Double-click the shape</> },
      { label: "Ignore object snapping", shortcut: <>Hold <Kbd>{KEY.mod}</Kbd> while dragging</> },
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
        {SHORTCUT_GROUPS.map((group) => (
          <section key={group.title}>
            <h3>{group.title}</h3>
            {group.items.map((item) => (
              <div className="shortcut-row" key={item.label}>
                <span>{item.label}</span>
                <span className="shortcut-keys">{item.shortcut}</span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  </div>
);
