import { useScene } from "../store";
import type { ReactNode } from "react";
import { getCommonBounds } from "../geometry";
import {
  applyStyleToSelection,
  changeZOrder,
  deleteSelection,
  duplicateSelection,
  groupSelection,
  toggleLockSelection,
  ungroupSelection,
} from "../actions";
import { PALETTE } from "../constants";
import { Tooltip } from "./Tooltip";
import {
  IconBringForward,
  IconDuplicate,
  IconGroup,
  IconLockClosed,
  IconTrash,
  IconUngroup,
} from "./icons";

export const SelectionToolbar = () => {
  const scene = useScene();
  const selected = scene.getSelected();
  if (
    selected.length === 0 ||
    scene.appState.editingTextId ||
    scene.appState.viewMode ||
    scene.appState.tool !== "selection"
  ) return null;

  const bounds = getCommonBounds(selected);
  const rawCenter = ((bounds.x1 + bounds.x2) / 2 + scene.appState.scrollX) * scene.appState.zoom;
  const center = Math.max(184, Math.min(window.innerWidth - 184, rawCenter));
  const top = Math.max(74, (bounds.y1 + scene.appState.scrollY) * scene.appState.zoom);
  const grouped = selected.some((element) => element.groupIds.length > 0);
  const locked = selected.every((element) => element.locked);
  const palette = PALETTE[scene.appState.theme];

  return (
    <div
      className="selection-toolbar island"
      role="toolbar"
      aria-label="Selection actions"
      style={{ left: center, top }}
    >
      <div className="selection-colors" aria-label="Quick colours">
        {palette.background.slice(1, 5).map((color) => (
          <button
            key={color}
            className="selection-color"
            aria-label={`Set background ${color}`}
            style={{ background: color }}
            onClick={() => applyStyleToSelection({ backgroundColor: color, fillStyle: "solid" })}
          />
        ))}
      </div>
      <span className="selection-toolbar-divider" />
      <ToolbarAction label="Duplicate" onClick={() => duplicateSelection()}><IconDuplicate /></ToolbarAction>
      {selected.length > 1 && !grouped && (
        <ToolbarAction label="Group" onClick={groupSelection}><IconGroup /></ToolbarAction>
      )}
      {grouped && <ToolbarAction label="Ungroup" onClick={ungroupSelection}><IconUngroup /></ToolbarAction>}
      <ToolbarAction label="Bring forward" onClick={() => changeZOrder("forward")}><IconBringForward /></ToolbarAction>
      <ToolbarAction label={locked ? "Unlock" : "Lock"} onClick={toggleLockSelection}><IconLockClosed /></ToolbarAction>
      <ToolbarAction label="Delete" danger onClick={deleteSelection}><IconTrash /></ToolbarAction>
    </div>
  );
};

const ToolbarAction = ({
  label,
  onClick,
  danger = false,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  children: ReactNode;
}) => (
  <Tooltip label={label} placement="top">
    <button className={`selection-action${danger ? " danger" : ""}`} aria-label={label} onClick={onClick}>
      {children}
    </button>
  </Tooltip>
);
