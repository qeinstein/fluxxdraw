import { useState, type ReactNode } from "react";
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
  tidyUpSelection,
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
  IconTidy,
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
  IconArrowheadNone,
  IconArrowheadArrow,
  IconArrowheadTriangle,
  IconArrowheadTriangleOutline,
  IconArrowheadBar,
  IconArrowheadDot,
  IconArrowheadNoneLeft,
  IconArrowheadArrowLeft,
  IconArrowheadTriangleLeft,
  IconArrowheadTriangleOutlineLeft,
  IconArrowheadBarLeft,
  IconArrowheadDotLeft,
  IconRouteStraight,
  IconRouteCurved,
  IconRouteElbow,
  IconSloppinessArchitect,
  IconSloppinessArtist,
  IconSloppinessCartoonist,
  IconFontSizeS,
  IconFontSizeM,
  IconFontSizeL,
  IconFontSizeXL,
} from "./icons";
import { FONTS, fontStack } from "../fonts";
import { instanceStyleValue } from "../components-model";
import type { ExcaliElement, Tool } from "../types";
import { sc } from "../shortcuts";
import { promptForInput } from "../prompt";

const STYLE_PRESETS_KEY = "fluxxdraw:style_presets";
type StylePreset = { name: string; style: Record<string, unknown> };

const loadStylePresets = (): StylePreset[] => {
  try {
    return JSON.parse(localStorage.getItem(STYLE_PRESETS_KEY) ?? "[]") as StylePreset[];
  } catch {
    return [];
  }
};

const SHAPE_TOOLS: Tool[] = [
  "rectangle",
  "sticky",
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
      : has("rectangle", "sticky", "diamond", "ellipse", "arrow", "line", "freedraw", "frame", "instance");

  return {
    background: shapeLike && (selected.length === 0 ? tool !== "freedraw" : !has("freedraw")),
    strokeWidth: shapeLike,
    sloppiness: shapeLike,
    edges:
      selected.length === 0
        ? ["rectangle", "sticky", "arrow", "line"].includes(tool)
        : has("rectangle", "sticky", "arrow", "line", "instance"),
    arrowheads: selected.length === 0 ? tool === "arrow" : has("arrow"),
    routing: selected.length === 0 ? ["arrow", "line"].includes(tool) : has("arrow", "line"),
    font: selected.length === 0 ? tool === "text" : has("text"),
    layout: selected.length > 0,
  };
};

/** Whether the panel would render anything — the mobile sheet toggle needs to know. */
export const hasStyleControls = (selected: ExcaliElement[], tool: Tool) =>
  relevantControls(selected, tool) !== null;



export const StylePanel = () => {
  const scene = useScene();
  const rawSelected = scene.getSelected();
  const editingText = scene.appState.editingTextId ? scene.getElement(scene.appState.editingTextId) : null;
  const selected = editingText
    ? (editingText.type === "text" && editingText.containerId ? [scene.getElement(editingText.containerId) ?? editingText] : [editingText])
    : rawSelected;

  const style = scene.appState.currentStyle;
  const palette = PALETTE[scene.appState.theme];
  const controls = relevantControls(selected, scene.appState.tool);
  const [presets, setPresets] = useState(loadStylePresets);

  if (!controls) return null;

  /**
   * Reads the shared value across the selection, falling back to the tool
   * default. Returns undefined when the selection disagrees, so no option
   * shows as active.
   */
  const valueOf = (key: string, fallback: unknown): unknown => {
    if (selected.length === 0) return fallback;
    // properties like fontSize only exist on some element types, and an
    // instance keeps its style in overrides rather than on itself
    const read = (el: ExcaliElement) =>
      el.type === "instance"
        ? instanceStyleValue(el, key)
        : (el as unknown as Record<string, unknown>)[key];
    const first = read(selected[0]);
    return selected.every((el) => read(el) === first) ? first : undefined;
  };

  const set = (patch: Record<string, unknown>) => applyStyleToSelection(patch);

  const savePreset = async () => {
    const name = await promptForInput({
      title: "Save style preset",
      label: "Preset name",
      placeholder: "Architecture node",
      confirmLabel: "Save preset",
      validate: (value) => value.trim() ? null : "Name this preset first.",
    });
    if (!name) return;
    const next = [
      { name: name.trim(), style: { ...scene.appState.currentStyle } },
      ...presets.filter((preset) => preset.name !== name.trim()),
    ].slice(0, 12);
    localStorage.setItem(STYLE_PRESETS_KEY, JSON.stringify(next));
    setPresets(next);
  };

  const removePreset = (name: string) => {
    const next = presets.filter((preset) => preset.name !== name);
    localStorage.setItem(STYLE_PRESETS_KEY, JSON.stringify(next));
    setPresets(next);
  };

  const strokeColor = String(valueOf("strokeColor", style.strokeColor) ?? palette.stroke[0]);
  const textColor = String(valueOf("textColor", (style as any).textColor ?? style.strokeColor) ?? palette.stroke[0]);
  const backgroundColor = String(
    valueOf("backgroundColor", style.backgroundColor) ?? "transparent",
  );

  return (
    <div 
      className="style-panel island" 
      onPointerDown={(e) => {
        // Prevent focus loss from TextEditor when clicking buttons, but allow inputs to work
        if ((e.target as HTMLElement).tagName !== "INPUT") e.preventDefault();
      }}
    >
      <Section label="Style presets">
        <div className="style-presets">
          <button className="style-preset-add" onClick={savePreset}>+ Save current</button>
          {presets.map((preset) => (
            <span className="style-preset" key={preset.name}>
              <button onClick={() => set(preset.style)}>{preset.name}</button>
              <button aria-label={`Delete ${preset.name}`} onClick={() => removePreset(preset.name)}>×</button>
            </span>
          ))}
        </div>
      </Section>
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
            options={[
              [0, "Architect", <IconSloppinessArchitect key="0" />],
              [1, "Artist", <IconSloppinessArtist key="1" />],
              [2, "Cartoonist", <IconSloppinessCartoonist key="2" />],
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
          <Choice
            options={[
              ["none", "None", <IconArrowheadNoneLeft key="1" />],
              ["arrow", "Arrow", <IconArrowheadArrowLeft key="2" />],
              ["triangle", "Triangle", <IconArrowheadTriangleLeft key="3" />],
              ["triangle-outline", "Triangle Outline", <IconArrowheadTriangleOutlineLeft key="4" />],
              ["bar", "Bar", <IconArrowheadBarLeft key="5" />],
              ["dot", "Dot", <IconArrowheadDotLeft key="6" />],
            ]}
            value={valueOf("startArrowhead", style.startArrowhead)}
            onChange={(v) => set({ startArrowhead: v })}
          />
          <Choice
            options={[
              ["none", "None", <IconArrowheadNone key="1" />],
              ["arrow", "Arrow", <IconArrowheadArrow key="2" />],
              ["triangle", "Triangle", <IconArrowheadTriangle key="3" />],
              ["triangle-outline", "Triangle Outline", <IconArrowheadTriangleOutline key="4" />],
              ["bar", "Bar", <IconArrowheadBar key="5" />],
              ["dot", "Dot", <IconArrowheadDot key="6" />],
            ]}
            value={valueOf("endArrowhead", style.endArrowhead)}
            onChange={(v) => set({ endArrowhead: v })}
          />
        </Section>
      )}

      {controls.routing && (
        <Section label="Routing">
          <Choice
            options={[
              ["straight", "Straight", <IconRouteStraight key="1" />],
              ["curved", "Curved", <IconRouteCurved key="2" />],
              ["elbow", "Elbow", <IconRouteElbow key="3" />],
            ]}
            value={valueOf("pathType", style.pathType)}
            onChange={(v) => set({ pathType: v })}
          />
        </Section>
      )}

      {controls.font && (
        <>
          <Section label="Text color">
            <Swatches
              colors={palette.stroke}
              value={textColor}
              onPick={(color) => set({ textColor: color })}
              customValue={textColor}
              onCustom={(color) => set({ textColor: color })}
            />
          </Section>
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
              options={[
                [FONT_SIZES.S, "Small", <IconFontSizeS key="1" />],
                [FONT_SIZES.M, "Medium", <IconFontSizeM key="2" />],
                [FONT_SIZES.L, "Large", <IconFontSizeL key="3" />],
                [FONT_SIZES.XL, "Extra Large", <IconFontSizeXL key="4" />],
              ]}
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
                    <IconAction
                      label="Tidy up"
                      onClick={() => tidyUpSelection()}
                    >
                      <IconTidy />
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

const ESSENTIAL_SECTIONS = new Set(["Style presets", "Stroke", "Background", "Opacity", "Actions"]);

const Section = ({ label, children }: { label: string; children: ReactNode }) => {
  const [open, setOpen] = useState(() => ESSENTIAL_SECTIONS.has(label));
  return (
    <details className="style-section" open={open}>
      <summary
        className="style-label"
        onClick={(event) => {
          event.preventDefault();
          setOpen((value) => !value);
        }}
      >
        {label}
      </summary>
      <div className="style-section-content">{children}</div>
    </details>
  );
};

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
