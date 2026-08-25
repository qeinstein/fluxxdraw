import { useMemo, useState, type ReactNode } from "react";
import { store, useScene } from "../store";
import { zoomToElement } from "./ZoomControls";
import { promptForInput } from "../prompt";
import {
  addCanvasComment,
  deleteCanvasComment,
  deleteRecoverySnapshot,
  getCanvasComments,
  getRecentDocuments,
  getRecoverySnapshots,
  type StoredDocument,
} from "../workspaceData";
import type { SceneDocument } from "../types";
import { IconClose, IconFolder, IconTrash } from "./icons";

type Tab = "layers" | "comments" | "recent" | "recovery";

export const WorkspacePanel = ({
  onClose,
  onOpen,
  onBrowse,
}: {
  onClose: () => void;
  onOpen: (document: SceneDocument, name: string) => void;
  onBrowse: () => void;
}) => {
  const scene = useScene();
  const [tab, setTab] = useState<Tab>("layers");
  const [query, setQuery] = useState("");
  const [comments, setComments] = useState(getCanvasComments);
  const [recovery, setRecovery] = useState(getRecoverySnapshots);
  const recent = getRecentDocuments();

  const layers = useMemo(() => {
    const labels = new Map(
      scene.visibleElements
        .filter((element) => element.type === "text")
        .map((element) => [element.containerId, element.text.trim()]),
    );
    const term = query.trim().toLowerCase();
    return scene.visibleElements
      .filter((element) => element.type !== "text" || !element.containerId)
      .map((element, index) => ({
        element,
        name: labels.get(element.id) || (element.type === "frame" ? element.name : `${element.type} ${index + 1}`),
      }))
      .filter((item) => !term || item.name.toLowerCase().includes(term) || item.element.type.includes(term))
      .reverse();
  }, [scene.getVersion(), query]);

  const createComment = async () => {
    const text = await promptForInput({
      title: "Add comment",
      label: "Comment",
      placeholder: "Leave a note for this part of the diagram…",
      confirmLabel: "Add comment",
      validate: (value) => value.trim() ? null : "Write a comment first.",
    });
    if (!text) return;
    const selected = scene.getSelected()[0] ?? null;
    const comment = addCanvasComment({
      elementId: selected?.id ?? null,
      x: selected ? selected.x + selected.width / 2 : -scene.appState.scrollX + 300,
      y: selected ? selected.y : -scene.appState.scrollY + 200,
      text: text.trim(),
    });
    setComments((items) => [comment, ...items]);
    store.emit();
  };

  const openStored = (item: StoredDocument) => onOpen(item.document, item.name);

  return (
    <aside className="workspace-panel library-sidebar" aria-label="Workspace">
      <header className="workspace-header">
        <strong>Workspace</strong>
        <button className="library-close" aria-label="Close workspace" onClick={onClose}><IconClose /></button>
      </header>
      <div className="workspace-tabs">
        {(["layers", "comments", "recent", "recovery"] as const).map((value) => (
          <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}>
            {value[0].toUpperCase() + value.slice(1)}
          </button>
        ))}
      </div>

      {tab === "layers" && (
        <>
          <div className="workspace-search"><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search layers…" /></div>
          <div className="workspace-list">
            {layers.map(({ element, name }) => (
              <button
                key={element.id}
                className={`workspace-row${scene.appState.selectedIds.includes(element.id) ? " active" : ""}`}
                onClick={() => {
                  store.setAppState({ selectedIds: [element.id], tool: "selection" });
                  zoomToElement(element.id);
                }}
              >
                <span className="workspace-type">{element.type}</span><strong>{name}</strong>
              </button>
            ))}
            {layers.length === 0 && <div className="workspace-empty">No matching layers.</div>}
          </div>
        </>
      )}

      {tab === "comments" && (
        <div className="workspace-list">
          <button className="workspace-primary" onClick={createComment}>Add comment to selection</button>
          {comments.map((comment) => (
            <div className="workspace-comment" key={comment.id}>
              <button onClick={() => comment.elementId && zoomToElement(comment.elementId)}>{comment.text}</button>
              <button className="workspace-delete" aria-label="Delete comment" onClick={() => {
                deleteCanvasComment(comment.id);
                setComments((items) => items.filter((item) => item.id !== comment.id));
                store.emit();
              }}><IconTrash /></button>
            </div>
          ))}
          {comments.length === 0 && <div className="workspace-empty">No comments yet.</div>}
        </div>
      )}

      {tab === "recent" && (
        <DocumentList items={recent} empty="No recent documents yet." onOpen={openStored} footer={
          <button className="workspace-primary" onClick={onBrowse}><IconFolder /> Browse files…</button>
        } />
      )}

      {tab === "recovery" && (
        <DocumentList
          items={recovery}
          empty="Recovery snapshots appear while you work."
          onOpen={openStored}
          onDelete={(id) => {
            deleteRecoverySnapshot(id);
            setRecovery((items) => items.filter((item) => item.id !== id));
          }}
        />
      )}
    </aside>
  );
};

const DocumentList = ({ items, empty, onOpen, onDelete, footer }: {
  items: StoredDocument[];
  empty: string;
  onOpen: (item: StoredDocument) => void;
  onDelete?: (id: string) => void;
  footer?: ReactNode;
}) => (
  <div className="workspace-list">
    {footer}
    {items.map((item) => (
      <div className="workspace-document" key={item.id}>
        <button onClick={() => onOpen(item)}><strong>{item.name}</strong><span>{new Date(item.updatedAt).toLocaleString()}</span></button>
        {onDelete && <button className="workspace-delete" aria-label="Delete snapshot" onClick={() => onDelete(item.id)}><IconTrash /></button>}
      </div>
    ))}
    {items.length === 0 && <div className="workspace-empty">{empty}</div>}
  </div>
);
