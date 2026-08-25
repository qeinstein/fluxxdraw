import { getCanvasComments } from "../workspaceData";
import { store, useScene } from "../store";
import { zoomToElement } from "./ZoomControls";

export const CommentPins = () => {
  const scene = useScene();
  if (scene.appState.viewMode) return null;
  return (
    <div className="comment-pins" aria-label="Canvas comments">
      {getCanvasComments().map((comment, index) => {
        const element = comment.elementId ? store.getElement(comment.elementId) : null;
        const x = ((element ? element.x + element.width : comment.x) + scene.appState.scrollX) * scene.appState.zoom;
        const y = ((element ? element.y : comment.y) + scene.appState.scrollY) * scene.appState.zoom;
        return (
          <button
            key={comment.id}
            className="comment-pin"
            style={{ left: x, top: y }}
            aria-label={comment.text}
            title={comment.text}
            onClick={() => {
              if (!comment.elementId) return;
              store.setAppState({ selectedIds: [comment.elementId], tool: "selection" });
              zoomToElement(comment.elementId);
            }}
          >
            {index + 1}
          </button>
        );
      })}
    </div>
  );
};
