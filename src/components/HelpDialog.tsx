import { IconClose } from "./icons";
import { KEY, formatCombo, sc } from "../shortcuts";

/**
 * Every combo here comes from the shortcuts table, so this sheet can't drift
 * out of step with what the app actually listens for.
 */
const GROUPS: { title: string; items: [string, string][] }[] = [
  {
    title: "Tools",
    items: [
      ["Selection", "1 / V"],
      ["Rectangle", "2 / R / S"],
      ["Sticky note", "N"],
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
    ],
  },
  {
    title: "Edit",
    items: [
      ["Undo", sc("undo")],
      ["Redo", `${sc("redo")} / ${sc("redoAlt")}`],
      ["Duplicate", `${sc("duplicate")} or ${KEY.alt}-drag`],
      ["Delete", "Delete / Backspace"],
      ["Select all", sc("selectAll")],
      ["Group", sc("group")],
      ["Ungroup", sc("ungroup")],
      ["Lock / unlock", sc("lock")],
      ["Bring to front / forward", `${sc("bringToFront")} / ${sc("bringForward")}`],
      ["Send to back / backward", `${sc("sendToBack")} / ${sc("sendBackward")}`],
      ["Nudge", "Arrow keys"],
      ["Nudge further", `${KEY.shift} + arrows`],
      ["Tidy up layout", sc("tidyUp")],
      ["Actions for what's under the cursor", "Right-click / long-press"],
      ["Link one object to another", "Right-click → Copy link, then Add link"],
      ["Follow a link", "Click the badge above the object"],
    ],
  },
  {
    title: "View",
    items: [
      ["Zoom in / out", `${sc("zoomIn")} / ${sc("zoomOut")}`],
      ["Reset zoom", sc("zoomReset")],
      ["Zoom to fit", sc("zoomToFit")],
      ["Pan", "Space-drag, middle-drag, or scroll"],
      ["Zoom at cursor", `${KEY.mod} + scroll`],
    ],
  },
  {
    title: "Files",
    items: [
      ["Open", sc("open")],
      ["Save", sc("save")],
      ["Save as", sc("saveAs")],
      ["Export", sc("export")],
      ["Version history", sc("history")],
      ["Present frames", sc("present")],
      ["Diagram as text", sc("diagramText")],
      ["Service library", sc("services")],
      ["Paste image / open file", `${formatCombo("mod+v")} or drag onto canvas`],
    ],
  },
  {
    title: "While drawing",
    items: [
      ["Constrain to square / circle", `Hold ${KEY.shift}`],
      ["Snap line to 15°", `Hold ${KEY.shift}`],
      ["Multi-point line", "Click, click, click… then Esc"],
      ["Add a point to a line", "Double-click the line"],
      ["Edit / add a shape label", "Double-click the shape"],
      ["Ignore object snapping", `Hold ${KEY.mod} while dragging`],
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
