import { getCanvasComments, deleteCanvasComment } from "../workspaceData";
import { store, useScene } from "../store";
import { useState } from "react";
import type { CanvasComment } from "../workspaceData";

export const CommentPins = () => {
  const scene = useScene();
  const [openId, setOpenId] = useState<string | null>(null);
  if (scene.appState.viewMode) return null;

  const allComments = getCanvasComments();

  // Group comments by elementId (or by position for unattached comments)
  const groups = new Map<string, CanvasComment[]>();
  for (const comment of allComments) {
    const key = comment.elementId ?? `pos:${comment.x},${comment.y}`;
    const list = groups.get(key) ?? [];
    list.push(comment);
    groups.set(key, list);
  }

  let pinIndex = 0;

  return (
    <div className="comment-pins" aria-label="Canvas comments">
      {Array.from(groups.entries()).map(([key, comments]) => {
        const first = comments[0];
        const element = first.elementId ? store.getElement(first.elementId) : null;
        const x = ((element ? element.x + element.width : first.x) + scene.appState.scrollX) * scene.appState.zoom;
        const y = ((element ? element.y : first.y) + scene.appState.scrollY) * scene.appState.zoom;
        pinIndex++;

        return (
          <div key={key} className="comment-pin-anchor" style={{ left: x, top: y }}>
            <button
              className="comment-pin"
              aria-label={comments.length === 1 ? first.text : `${comments.length} comments`}
              onPointerDown={(e) => { e.stopPropagation(); setOpenId(openId === key ? null : key); }}
            >
              {pinIndex}
            </button>
            {openId === key && (
              <div className="comment-popover" onPointerDown={(e) => e.stopPropagation()}>
                {comments.map((comment) => (
                  <div key={comment.id} className="comment-popover-item">
                    <p>{comment.text}</p>
                    <button
                      className="comment-delete-btn"
                      aria-label="Delete comment"
                      onClick={() => {
                        deleteCanvasComment(comment.id);
                        // If last comment in group, close popover
                        if (comments.length <= 1) setOpenId(null);
                        store.emit();
                      }}
                    >×</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
