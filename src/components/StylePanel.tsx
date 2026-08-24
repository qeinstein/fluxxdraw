import { useScene } from "../store";
import {
  BACKGROUND_COLORS,
  FONT_SIZES,
  STROKE_COLORS,
  STROKE_WIDTHS,
} from "../constants";
import {
  alignSelection,
  applyStyleToSelection,
  changeZOrder,
  deleteSelection,
  distributeSelection,
  duplicateSelection,
  groupSelection,
  toggleLockSelection,
  ungroupSelection,
} from "../actions";
import type { Arrowhead, ExcaliElement, FontFamily, Tool } from "../types";

const SHAPE_TOOLS: Tool[] = ["rectangle", "diamond", "ellipse", "arrow", "line", "freedraw", "frame"];

/** Which controls make sense for the current selection (or active tool). */
const relevantControls = (selected: ExcaliElement[], tool: Tool) => {
  const types = new Set(selected.map((el) => el.type));
  const drawing = SHAPE_TOOLS.includes(tool) || tool === "text";
  const has = (...t: ExcaliElement["type"][]) => t.some((x) => types.has(x));

  if (selected.length === 0 && !drawing) return null;

  const shapeLike =
    selected.length === 0
      ? SHAPE_TOOLS.includes(tool)
      : has("rectangle", "diamond", "ellipse", "arrow", "line", "freedraw", "frame");

  return {
    stroke: true,
    background: shapeLike && (selected.length === 0 ? tool !== "freedraw" : !has("freedraw")),
    strokeWidth: shapeLike,
    sloppiness: shapeLike,
    edges:
      selected.length === 0
        ? ["rectangle", "arrow", "line"].includes(tool)
        : has("rectangle", "arrow", "line"),
    arrowheads: selected.length === 0 ? tool === "arrow" : has("arrow"),
    elbow: selected.length === 0 ? tool === "arrow" : has("arrow"),
    font: selected.length === 0 ? tool === "text" : has("text"),
    layout: selected.length > 0,
  };
};

const ARROWHEADS: { value: Arrowhead; label: string }[] = [
  { value: "none", label: "—" },
  { value: "arrow", label: "→" },
  { value: "triangle", label: "▶" },
  { value: "triangle-outline", label: "▷" },
  { value: "bar", label: "|" },
  { value: "dot", label: "●" },
];

const FONTS: { value: FontFamily; label: string }[] = [
  { value: "hand", label: "Hand-drawn" },
  { value: "normal", label: "Normal" },
  { value: "code", label: "Code" },
];

export const StylePanel = () => {
  const scene = useScene();
  const selected = scene.getSelected();
  const style = scene.appState.currentStyle;
  const controls = relevantControls(selected, scene.appState.tool);

  if (!controls) return null;

  /**
   * Reads the shared value across the selection, falling back to the tool
   * default. Returns undefined when the selection disagrees, so no option
   * shows as active.
   */
  const valueOf = (key: string, fallback: unknown): unknown => {
    if (selected.length === 0) return fallback;
    // properties like fontSize only exist on some element types
    const read = (el: ExcaliElement) => (el as unknown as Record<string, unknown>)[key];
    const first = read(selected[0]);
    return selected.every((el) => read(el) === first) ? first : undefined;
  };

  const set = (patch: Record<string, unknown>) => applyStyleToSelection(patch);

  return (
    <div className="style-panel island">
      <Section label="Stroke">
        <div className="swatches">
          {STROKE_COLORS.map((color) => (
            <button
              key={color}
              className={`swatch ${valueOf("strokeColor", style.strokeColor) === color ? "active" : ""}`}
              style={{ background: color }}
              onClick={() => set({ strokeColor: color })}
              title={color}
            />
          ))}
          <input
            type="color"
            className="color-input"
            value={String(valueOf("strokeColor", style.strokeColor) ?? "#1e1e1e")}
            onChange={(e) => set({ strokeColor: e.target.value })}
            title="Custom stroke colour"
          />
        </div>
      </Section>

      {controls.background && (
        <Section label="Background">
          <div className="swatches">
            {BACKGROUND_COLORS.map((color) => (
              <button
                key={color}
                className={`swatch ${color === "transparent" ? "transparent" : ""} ${
                  valueOf("backgroundColor", style.backgroundColor) === color ? "active" : ""
                }`}
                style={color === "transparent" ? undefined : { background: color }}
                onClick={() => set({ backgroundColor: color })}
                title={color}
              />
            ))}
            <input
              type="color"
              className="color-input"
              value={
                String(valueOf("backgroundColor", style.backgroundColor) ?? "#ffffff") ===
                "transparent"
                  ? "#ffffff"
                  : String(valueOf("backgroundColor", style.backgroundColor) ?? "#ffffff")
              }
              onChange={(e) => set({ backgroundColor: e.target.value })}
              title="Custom fill colour"
            />
          </div>
        </Section>
      )}

      {controls.background && (
        <Section label="Fill">
          <Choice
            options={[
              ["hachure", "▨"],
              ["cross-hatch", "▩"],
              ["solid", "■"],
              ["zigzag", "☰"],
            ]}
            value={valueOf("fillStyle", style.fillStyle)}
            onChange={(v) => set({ fillStyle: v })}
          />
        </Section>
      )}

      {controls.strokeWidth && (
        <Section label="Stroke width">
          <Choice
            options={[
              [STROKE_WIDTHS.thin, "▁"],
              [STROKE_WIDTHS.bold, "▃"],
              [STROKE_WIDTHS.extraBold, "▅"],
            ]}
            value={valueOf("strokeWidth", style.strokeWidth)}
            onChange={(v) => set({ strokeWidth: v })}
          />
        </Section>
      )}

      {controls.strokeWidth && (
        <Section label="Stroke style">
          <Choice
            options={[
              ["solid", "───"],
              ["dashed", "╌╌╌"],
              ["dotted", "┈┈┈"],
            ]}
            value={valueOf("strokeStyle", style.strokeStyle)}
            onChange={(v) => set({ strokeStyle: v })}
          />
        </Section>
      )}

      {controls.sloppiness && (
        <Section label="Sloppiness">
          <Choice
            options={[
              [0, "Architect"],
              [1, "Artist"],
              [2, "Cartoonist"],
            ]}
            value={valueOf("roughness", style.roughness)}
            onChange={(v) => set({ roughness: v })}
            wide
          />
        </Section>
      )}

      {controls.edges && (
        <Section label="Edges">
          <Choice
            options={[
              ["sharp", "◺"],
              ["round", "◜"],
            ]}
            value={valueOf("edges", style.edges)}
            onChange={(v) => set({ edges: v })}
          />
        </Section>
      )}

      {controls.arrowheads && (
        <Section label="Arrowheads">
          <div className="row">
            <select
              value={String(valueOf("startArrowhead", style.startArrowhead) ?? "none")}
              onChange={(e) => set({ startArrowhead: e.target.value })}
              title="Start"
            >
              {ARROWHEADS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label} start
                </option>
              ))}
            </select>
            <select
              value={String(valueOf("endArrowhead", style.endArrowhead) ?? "arrow")}
              onChange={(e) => set({ endArrowhead: e.target.value })}
              title="End"
            >
              {ARROWHEADS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label} end
                </option>
              ))}
            </select>
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={Boolean(valueOf("elbowed", style.elbowed))}
              onChange={(e) => set({ elbowed: e.target.checked })}
            />
            Elbowed (90° routing)
          </label>
        </Section>
      )}

      {controls.font && (
        <>
          <Section label="Font">
            <Choice
              options={FONTS.map((f) => [f.value, f.label] as [string, string])}
              value={valueOf("fontFamily", style.fontFamily)}
              onChange={(v) => set({ fontFamily: v })}
              wide
            />
          </Section>
          <Section label="Font size">
            <Choice
              options={Object.entries(FONT_SIZES).map(
                ([label, size]) => [size, label] as [number, string],
              )}
              value={valueOf("fontSize", style.fontSize)}
              onChange={(v) => set({ fontSize: v })}
            />
          </Section>
          <Section label="Align">
            <Choice
              options={[
                ["left", "⇤"],
                ["center", "↔"],
                ["right", "⇥"],
              ]}
              value={valueOf("textAlign", style.textAlign)}
              onChange={(v) => set({ textAlign: v })}
            />
          </Section>
        </>
      )}

      <Section label="Opacity">
        <input
          type="range"
          min={0}
          max={100}
          step={10}
          value={Number(valueOf("opacity", style.opacity) ?? 100)}
          onChange={(e) => set({ opacity: Number(e.target.value) })}
        />
      </Section>

      {controls.layout && (
        <>
          <Section label="Layers">
            <div className="row">
              <button onClick={() => changeZOrder("back")} title="Send to back">
                ⤓
              </button>
              <button onClick={() => changeZOrder("backward")} title="Send backward">
                ↓
              </button>
              <button onClick={() => changeZOrder("forward")} title="Bring forward">
                ↑
              </button>
              <button onClick={() => changeZOrder("front")} title="Bring to front">
                ⤒
              </button>
            </div>
          </Section>

          {selected.length > 1 && (
            <Section label="Align">
              <div className="row">
                <button onClick={() => alignSelection("left")} title="Align left">
                  ⇤
                </button>
                <button onClick={() => alignSelection("center-x")} title="Centre horizontally">
                  ↔
                </button>
                <button onClick={() => alignSelection("right")} title="Align right">
                  ⇥
                </button>
                <button onClick={() => alignSelection("top")} title="Align top">
                  ⤒
                </button>
                <button onClick={() => alignSelection("center-y")} title="Centre vertically">
                  ↕
                </button>
                <button onClick={() => alignSelection("bottom")} title="Align bottom">
                  ⤓
                </button>
              </div>
              {selected.length > 2 && (
                <div className="row">
                  <button onClick={() => distributeSelection("horizontal")}>
                    Distribute ↔
                  </button>
                  <button onClick={() => distributeSelection("vertical")}>Distribute ↕</button>
                </div>
              )}
            </Section>
          )}

          <Section label="Actions">
            <div className="row">
              <button onClick={() => duplicateSelection()} title="Duplicate (Cmd+D)">
                ⧉
              </button>
              <button onClick={() => groupSelection()} title="Group (Cmd+G)">
                ⛶
              </button>
              <button onClick={() => ungroupSelection()} title="Ungroup (Cmd+Shift+G)">
                ⛞
              </button>
              <button onClick={toggleLockSelection} title="Lock/unlock">
                🔒
              </button>
              <button onClick={deleteSelection} title="Delete" className="danger">
                🗑
              </button>
            </div>
          </Section>
        </>
      )}
    </div>
  );
};

const Section = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="style-section">
    <div className="style-label">{label}</div>
    {children}
  </div>
);

interface ChoiceProps<T> {
  options: [T, string][];
  value: unknown;
  onChange: (value: T) => void;
  wide?: boolean;
}

const Choice = <T extends string | number>({
  options,
  value,
  onChange,
  wide,
}: ChoiceProps<T>) => (
  <div className={`row ${wide ? "wide" : ""}`}>
    {options.map(([optionValue, label]) => (
      <button
        key={String(optionValue)}
        className={value === optionValue ? "active" : ""}
        onClick={() => onChange(optionValue)}
      >
        {label}
      </button>
    ))}
  </div>
);
