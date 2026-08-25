import { getCanvasComments } from "../workspaceData";
import { store, useScene } from "../store";
import { zoomToElement } from "./ZoomControls";
import { useState } from "react";
import { addCanvasComment } from "../workspaceData";
import { promptForInput } from "../prompt";

export const CommentPins = () => {
  const scene = useScene();
  const [openId, setOpenId] = useState<string | null>(null);
  if (scene.appState.viewMode) return null;
  return (
    <div className="comment-pins" aria-label="Canvas comments">
      {getCanvasComments().map((comment, index) => {
        const element = comment.elementId ? store.getElement(comment.elementId) : null;
        const x = ((element ? element.x + element.width : comment.x) + scene.appState.scrollX) * scene.appState.zoom;
        const y = ((element ? element.y : comment.y) + scene.appState.scrollY) * scene.appState.zoom;
        return (
          <div key={comment.id} className="comment-pin-anchor" style={{ left: x, top: y }}>
            <button className="comment-pin" aria-label={comment.text} onClick={() => setOpenId(openId === comment.id ? null : comment.id)}>
              {index + 1}
            </button>
            {openId === comment.id && (
              <div className="comment-popover">
                <p>{comment.text}</p>
                <div>
                  {comment.elementId && <button onClick={() => zoomToElement(comment.elementId!)}>Focus object</button>}
                  <button onClick={async () => {
                    const text = await promptForInput({ title: "Add comment", label: "Comment", placeholder: "Add another note…", confirmLabel: "Add comment", validate: (value) => value.trim() ? null : "Write a comment first." });
                    if (!text) return;
                    addCanvasComment({ elementId: comment.elementId, x: comment.x, y: comment.y, text: text.trim() });
                    store.emit();
                  }}>Add comment</button>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
