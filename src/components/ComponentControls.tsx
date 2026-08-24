import { useState } from "react";
import { store, useScene } from "../store";
import {
  beginComponentEdit,
  cancelComponentEdit,
  commitComponentEdit,
  countInstances,
  createComponentFromSelection,
  detachInstance,
  placeInstance,
  type ComponentEditSession,
} from "../components-model";
import { Tooltip } from "./Tooltip";
import { IconDuplicate, IconGroup, IconUngroup } from "./icons";
import type { InstanceElement } from "../types";

interface ComponentControlsProps {
  session: ComponentEditSession | null;
  editingInstanceId: string | null;
  onSessionChange: (session: ComponentEditSession | null, instanceId: string | null) => void;
}

/**
 * Component actions for the current selection, plus the library of definitions
 * already in the document.
 */
export const ComponentControls = ({
  session,
  editingInstanceId,
  onSessionChange,
}: ComponentControlsProps) => {
  const scene = useScene();
  const selected = scene.getSelected();
  const definitions = Object.values(scene.components);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const soleInstance =
    selected.length === 1 && selected[0].type === "instance"
      ? (selected[0] as InstanceElement)
      : null;

  // while editing a master, the panel becomes a focused save/discard bar
  if (session && editingInstanceId) {
    const definition = scene.components[session.componentId];
    const instances = countInstances(session.componentId);
    return (
      <div className="component-editing island">
        <div className="component-editing-text">
          <strong>Editing “{definition?.name ?? "component"}”</strong>
          <span className="hint">
            Changes apply to {instances} instance{instances === 1 ? "" : "s"}
          </span>
        </div>
        <button
          onClick={() => {
            cancelComponentEdit(session, editingInstanceId);
            onSessionChange(null, null);
          }}
        >
          Discard
        </button>
        <button
          className="primary"
          onClick={() => {
            commitComponentEdit(session, editingInstanceId);
            onSessionChange(null, null);
          }}
        >
          Save component
        </button>
      </div>
    );
  }

  if (selected.length === 0 && definitions.length === 0) return null;

  return (
    <div className="component-panel island">
      {soleInstance ? (
        <>
          <div className="style-label">
            {scene.components[soleInstance.componentId]?.name ?? "Component"} ·{" "}
            {countInstances(soleInstance.componentId)} instance
            {countInstances(soleInstance.componentId) === 1 ? "" : "s"}
          </div>
          <div className="row">
            <button
              onClick={() => {
                const next = beginComponentEdit(soleInstance.id);
                if (next) onSessionChange(next, soleInstance.id);
              }}
            >
              Edit master
            </button>
            <Tooltip label="Place another copy">
              <button
                aria-label="Duplicate instance"
                onClick={() =>
                  placeInstance(
                    soleInstance.componentId,
                    soleInstance.x + 24,
                    soleInstance.y + 24,
                  )
                }
              >
                <IconDuplicate />
              </button>
            </Tooltip>
            <Tooltip label="Detach into plain shapes">
              <button aria-label="Detach" onClick={() => detachInstance(soleInstance.id)}>
                <IconUngroup />
              </button>
            </Tooltip>
          </div>
        </>
      ) : (
        selected.length > 0 && (
          <button
            className="component-make"
            onClick={() => {
              const name = window.prompt("Name this component");
              if (name === null) return;
              createComponentFromSelection(name);
            }}
          >
            <IconGroup />
            Make component
          </button>
        )
      )}

      {definitions.length > 0 && (
        <>
          <button
            className="component-library-toggle"
            onClick={() => setLibraryOpen((v) => !v)}
          >
            {libraryOpen ? "Hide" : "Show"} components ({definitions.length})
          </button>
          {libraryOpen && (
            <div className="component-library">
              {definitions.map((definition) => (
                <Tooltip
                  key={definition.id}
                  label={`Place “${definition.name}”`}
                  placement="right"
                >
                  <button
                    className="component-chip"
                    onClick={() => {
                      // drop it into the middle of the current view
                      const container = document.querySelector(".canvas-container");
                      const rect = container?.getBoundingClientRect();
                      const { scrollX, scrollY, zoom } = store.appState;
                      const x = rect ? rect.width / (2 * zoom) - scrollX : 0;
                      const y = rect ? rect.height / (2 * zoom) - scrollY : 0;
                      placeInstance(
                        definition.id,
                        x - definition.width / 2,
                        y - definition.height / 2,
                      );
                    }}
                  >
                    {definition.name}
                    <span className="hint">{countInstances(definition.id)}</span>
                  </button>
                </Tooltip>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
