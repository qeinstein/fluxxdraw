import type { ReactNode } from "react";
import { useScene } from "../store";
import { FONT_SIZES, PALETTE, STROKE_WIDTHS } from "../constants";
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
import { Tooltip } from "./Tooltip";
import {
  IconAlignBottom,
  IconAlignCentreX,
  IconAlignCentreY,
  IconAlignLeft,
  IconAlignRight,
  IconAlignTop,
  IconBringForward,
  IconBringToFront,
  IconDistributeX,
  IconDistributeY,
  IconDuplicate,
  IconEdgeRound,
  IconEdgeSharp,
  IconFillCross,
  IconFillHachure,
  IconFillSolid,
  IconFillZigzag,
  IconGroup,
  IconLockClosed,
  IconSendBackward,
  IconSendToBack,
  IconStrokeDashed,
  IconStrokeDotted,
  IconStrokeSolid,
  IconTextCentre,
  IconTextLeft,
  IconTextRight,
  IconTrash,
  IconUngroup,
  IconWidthBold,
  IconWidthExtraBold,
  IconWidthThin,
} from "./icons";
import { FONTS, fontStack } from "../fonts";
import type { Arrowhead, ExcaliElement, Tool } from "../types";
import { sc } from "../shortcuts";

const SHAPE_TOOLS: Tool[] = [
  "rectangle",
  "diamond",
  "ellipse",
  "arrow",
  "line",
  "freedraw",
  "frame",
];

/** Which controls make sense for the current selection (or active tool). */
const relevantControls = (selected: ExcaliElement[], tool: Tool) => {
  const types = new Set(selected.map((el) => el.type));
  const drawing = SHAPE_TOOLS.includes(tool) || tool === "text";
  const has = (...t: ExcaliElement["type"][]) => t.some((x) => types.has(x));

  if (selected.length === 0 && !drawing) return null;

  /*
   * Instances count as shape-like: a placed component takes the same stroke,
   * fill and sloppiness settings as anything else, applied over its master.
   */
  const shapeLike =
    selected.length === 0
      ? SHAPE_TOOLS.includes(tool)
      : has("rectangle", "diamond", "ellipse", "arrow", "line", "freedraw", "frame", "instance");

  return {
    background: shapeLike && (selected.length === 0 ? tool !== "freedraw" : !has("freedraw")),
    strokeWidth: shapeLike,
    sloppiness: shapeLike,
    edges:
      selected.length === 0
        ? ["rectangle", "arrow", "line"].includes(tool)
        : has("rectangle", "arrow", "line", "instance"),
    arrowheads: selected.length === 0 ? tool === "arrow" : has("arrow"),
    font: selected.length === 0 ? tool === "text" : has("text"),
    layout: selected.length > 0,
  };
};

/** Whether the panel would render anything — the mobile sheet toggle needs to know. */
export const hasStyleControls = (selected: ExcaliElement[], tool: Tool) =>
  relevantControls(selected, tool) !== null;

const ARROWHEADS: { value: Arrowhead; label: string }[] = [
  { value: "none", label: "None" },
  { value: "arrow", label: "Arrow" },
  { value: "triangle", label: "Triangle" },
  { value: "triangle-outline", label: "Triangle outline" },
  { value: "bar", label: "Bar" },
  { value: "dot", label: "Dot" },
];

export const StylePanel = () => {
  const scene = useScene();
  const selected = scene.getSelected();
  const style = scene.appState.currentStyle;
  const palette = PALETTE[scene.appState.theme];
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

  const strokeColor = String(valueOf("strokeColor", style.strokeColor) ?? palette.stroke[0]);
  const backgroundColor = String(
    valueOf("backgroundColor", style.backgroundColor) ?? "transparent",
  );

  return (
    <div className="style-panel island">
      <Section label="Stroke">
        <Swatches
          colors={palette.stroke}
          value={strokeColor}
          onPick={(color) => set({ strokeColor: color })}
          customValue={strokeColor}
          onCustom={(color) => set({ strokeColor: color })}
        />
      </Section>

      {controls.background && (
        <Section label="Background">
          <Swatches
            colors={palette.background}
            value={backgroundColor}
            onPick={(color) => set({ backgroundColor: color })}
            customValue={backgroundColor === "transparent" ? palette.background[1] : backgroundColor}
            onCustom={(color) => set({ backgroundColor: color })}
          />
        </Section>
      )}

      {controls.background && backgroundColor !== "transparent" && (
        <Section label="Fill">
          <Choice
            options={[
              ["hachure", "Hachure", <IconFillHachure key="h" />],
              ["cross-hatch", "Cross-hatch", <IconFillCross key="c" />],
              ["solid", "Solid", <IconFillSolid key="s" />],
              ["zigzag", "Zigzag", <IconFillZigzag key="z" />],
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
              [STROKE_WIDTHS.thin, "Thin", <IconWidthThin key="1" />],
              [STROKE_WIDTHS.bold, "Bold", <IconWidthBold key="2" />],
              [STROKE_WIDTHS.extraBold, "Extra bold", <IconWidthExtraBold key="3" />],
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
              ["solid", "Solid", <IconStrokeSolid key="1" />],
              ["dashed", "Dashed", <IconStrokeDashed key="2" />],
              ["dotted", "Dotted", <IconStrokeDotted key="3" />],
            ]}
            value={valueOf("strokeStyle", style.strokeStyle)}
            onChange={(v) => set({ strokeStyle: v })}
          />
        </Section>
      )}

      {controls.sloppiness && (
        <Section label="Sloppiness">
          <Choice
            variant="text"
            options={[
              [0, "Architect", "Architect"],
              [1, "Artist", "Artist"],
              [2, "Cartoonist", "Cartoon"],
            ]}
            value={valueOf("roughness", style.roughness)}
            onChange={(v) => set({ roughness: v })}
          />
        </Section>
      )}

      {controls.edges && (
        <Section label="Edges">
          <Choice
            options={[
              ["sharp", "Sharp", <IconEdgeSharp key="1" />],
              ["round", "Round", <IconEdgeRound key="2" />],
            ]}
            value={valueOf("edges", style.edges)}
            onChange={(v) => set({ edges: v })}
          />
        </Section>
      )}

      {controls.arrowheads && (
        <Section label="Arrowheads">
          <div className="row split">
            <select
              aria-label="Start arrowhead"
              value={String(valueOf("startArrowhead", style.startArrowhead) ?? "none")}
              onChange={(e) => set({ startArrowhead: e.target.value })}
            >
              {ARROWHEADS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
            <select
              aria-label="End arrowhead"
              value={String(valueOf("endArrowhead", style.endArrowhead) ?? "arrow")}
              onChange={(e) => set({ endArrowhead: e.target.value })}
            >
              {ARROWHEADS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
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
            <span>Elbowed routing</span>
          </label>
        </Section>
      )}

      {controls.font && (
        <>
          <Section label="Font">
            <div className="row choice choice--font">
              {FONTS.map((font) => (
                <Tooltip key={font.id} label={font.label}>
                  <button
                    className={valueOf("fontFamily", style.fontFamily) === font.id ? "active" : ""}
                    aria-label={font.label}
                    aria-pressed={valueOf("fontFamily", style.fontFamily) === font.id}
                    style={{ fontFamily: fontStack(font.id) }}
                    onClick={() => set({ fontFamily: font.id })}
                  >
                    Ag
                  </button>
                </Tooltip>
              ))}
            </div>
          </Section>
          <Section label="Font size">
            <Choice
              variant="text"
              options={Object.entries(FONT_SIZES).map(
                ([label, size]) => [size, `${label} (${size}px)`, label] as [number, string, string],
              )}
              value={valueOf("fontSize", style.fontSize)}
              onChange={(v) => set({ fontSize: v })}
            />
          </Section>
          <Section label="Text align">
            <Choice
              options={[
                ["left", "Left", <IconTextLeft key="1" />],
                ["center", "Centre", <IconTextCentre key="2" />],
                ["right", "Right", <IconTextRight key="3" />],
              ]}
              value={valueOf("textAlign", style.textAlign)}
              onChange={(v) => set({ textAlign: v })}
            />
          </Section>
        </>
      )}

      <Section label="Opacity">
        <input
          className="slider"
          type="range"
          aria-label="Opacity"
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
              <IconAction label="Send to back" shortcut={sc("sendToBack")} onClick={() => changeZOrder("back")}>
                <IconSendToBack />
              </IconAction>
              <IconAction
                label="Send backward"
                shortcut={sc("sendBackward")}
                onClick={() => changeZOrder("backward")}
              >
                <IconSendBackward />
              </IconAction>
              <IconAction
                label="Bring forward"
                shortcut={sc("bringForward")}
                onClick={() => changeZOrder("forward")}
              >
                <IconBringForward />
              </IconAction>
              <IconAction
                label="Bring to front"
                shortcut={sc("bringToFront")}
                onClick={() => changeZOrder("front")}
              >
                <IconBringToFront />
              </IconAction>
            </div>
          </Section>

          {selected.length > 1 && (
            <Section label="Align">
              <div className="row">
                <IconAction label="Align left" onClick={() => alignSelection("left")}>
                  <IconAlignLeft />
                </IconAction>
                <IconAction label="Centre horizontally" onClick={() => alignSelection("center-x")}>
                  <IconAlignCentreX />
                </IconAction>
                <IconAction label="Align right" onClick={() => alignSelection("right")}>
                  <IconAlignRight />
                </IconAction>
                <IconAction label="Align top" onClick={() => alignSelection("top")}>
                  <IconAlignTop />
                </IconAction>
                <IconAction label="Centre vertically" onClick={() => alignSelection("center-y")}>
                  <IconAlignCentreY />
                </IconAction>
                <IconAction label="Align bottom" onClick={() => alignSelection("bottom")}>
                  <IconAlignBottom />
                </IconAction>
                {selected.length > 2 && (
                  <>
                    <IconAction
                      label="Distribute horizontally"
                      onClick={() => distributeSelection("horizontal")}
                    >
                      <IconDistributeX />
                    </IconAction>
                    <IconAction
                      label="Distribute vertically"
                      onClick={() => distributeSelection("vertical")}
                    >
                      <IconDistributeY />
                    </IconAction>
                  </>
                )}
              </div>
            </Section>
          )}

          <Section label="Actions">
            <div className="row">
              <IconAction label="Duplicate" shortcut={sc("duplicate")} onClick={() => duplicateSelection()}>
                <IconDuplicate />
              </IconAction>
              <IconAction label="Group" shortcut={sc("group")} onClick={groupSelection}>
                <IconGroup />
              </IconAction>
              <IconAction label="Ungroup" shortcut={sc("ungroup")} onClick={ungroupSelection}>
                <IconUngroup />
              </IconAction>
              <IconAction label="Lock" shortcut={sc("lock")} onClick={toggleLockSelection}>
                <IconLockClosed />
              </IconAction>
              <IconAction label="Delete" shortcut="Del" onClick={deleteSelection} danger>
                <IconTrash />
              </IconAction>
            </div>
          </Section>
        </>
      )}
    </div>
  );
};

const Section = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="style-section">
    <div className="style-label">{label}</div>
    {children}
  </div>
);

interface SwatchesProps {
  colors: readonly string[];
  value: string;
  onPick: (color: string) => void;
  customValue: string;
  onCustom: (color: string) => void;
}

const Swatches = ({ colors, value, onPick, customValue, onCustom }: SwatchesProps) => (
  <div className="swatches">
    {colors.map((color) => (
      <Tooltip key={color} label={color === "transparent" ? "Transparent" : color}>
        <button
          className={`swatch ${color === "transparent" ? "is-transparent" : ""} ${
            value === color ? "active" : ""
          }`}
          style={color === "transparent" ? undefined : { background: color }}
          aria-label={color}
          aria-pressed={value === color}
          onClick={() => onPick(color)}
        />
      </Tooltip>
    ))}
    <span className="swatch-divider" />
    <Tooltip label="Custom colour">
      <span className="swatch custom-swatch" style={{ background: customValue }}>
        <input
          type="color"
          aria-label="Custom colour"
          value={customValue}
          onChange={(e) => onCustom(e.target.value)}
        />
      </span>
    </Tooltip>
  </div>
);

interface ChoiceProps<T> {
  /** [value, tooltip label, visible content] */
  options: [T, string, ReactNode][];
  value: unknown;
  onChange: (value: T) => void;
  variant?: "icon" | "text";
}

const Choice = <T extends string | number>({
  options,
  value,
  onChange,
  variant = "icon",
}: ChoiceProps<T>) => (
  <div className={`row choice choice--${variant}`}>
    {options.map(([optionValue, label, content]) => (
      <Tooltip key={String(optionValue)} label={label}>
        <button
          className={value === optionValue ? "active" : ""}
          aria-label={label}
          aria-pressed={value === optionValue}
          onClick={() => onChange(optionValue)}
        >
          {content}
        </button>
      </Tooltip>
    ))}
  </div>
);

interface IconActionProps {
  label: string;
  shortcut?: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}

const IconAction = ({ label, shortcut, onClick, danger, children }: IconActionProps) => (
  <Tooltip label={label} shortcut={shortcut}>
    <button className={danger ? "danger" : ""} aria-label={label} onClick={onClick}>
      {children}
    </button>
  </Tooltip>
);
