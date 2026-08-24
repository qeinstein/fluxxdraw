import { useEffect, useRef, useState } from "react";
import { useScene } from "../store";
import { parseDiagram, type ParseIssue } from "../dsl/parse";
import { specFromScene, specToText } from "../dsl/fromScene";
import { applySpecToScene } from "../dsl/apply";
import { canonical, type DiagramSpec } from "../dsl/spec";
import { Tooltip } from "./Tooltip";
import { IconClose } from "./icons";

interface DiagramTextPanelProps {
  onClose: () => void;
}

/** How long typing has to settle before the canvas is rebuilt. */
const TYPING_DEBOUNCE_MS = 450;

const PLACEHOLDER = `# Describe the diagram, or draw it — either side updates the other.

api: API Gateway
db: Postgres [ellipse] {blue}
cache: Redis [diamond]

api -> db: queries
api --> cache`;

/**
 * The text view of the diagram, kept in sync with the canvas in both
 * directions.
 *
 * The two directions are reconciled through a canonical form rather than by
 * trying to sequence the edits. Text is only rewritten when the canvas's spec
 * genuinely differs from what the text already says, and the canvas is only
 * rebuilt when the parsed spec differs from what the canvas already holds — so
 * neither side can echo the other's change back and start a loop.
 *
 * Direction is also gated on focus: while you are typing, the canvas never
 * rewrites your text under the cursor.
 */
export const DiagramTextPanel = ({ onClose }: DiagramTextPanelProps) => {
  const scene = useScene();
  const [text, setText] = useState("");
  const [issues, setIssues] = useState<ParseIssue[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const focusedRef = useRef(false);
  /** the spec both sides currently agree on */
  const agreedRef = useRef<string>("");
  const timerRef = useRef<number | undefined>(undefined);

  // seed the panel from whatever is already drawn
  useEffect(() => {
    const { spec, untranslatable } = specFromScene();
    agreedRef.current = canonical(spec);
    setText(specToText(spec));
    if (untranslatable > 0) {
      setStatus(
        `${untranslatable} element${untranslatable === 1 ? "" : "s"} on the canvas can't be written as text and won't be touched.`,
      );
    }
    return () => window.clearTimeout(timerRef.current);
  }, []);

  // canvas -> text, but never while the user is typing into the panel
  useEffect(() => {
    if (focusedRef.current) return;
    const { spec } = specFromScene();
    const key = canonical(spec);
    if (key === agreedRef.current) return;
    agreedRef.current = key;
    setText(specToText(spec));
    setIssues([]);
  }, [scene.getVersion()]);

  // text -> canvas, debounced so a half-typed line doesn't rebuild anything
  const scheduleApply = (next: string) => {
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      const { spec, issues: found } = parseDiagram(next);
      setIssues(found);

      const key = canonical(spec as DiagramSpec);
      if (key === agreedRef.current) return;

      const result = applySpecToScene(spec);
      // read the scene back, so the agreed form reflects what actually landed
      agreedRef.current = canonical(specFromScene().spec);

      const parts: string[] = [];
      if (result.created) parts.push(`${result.created} added`);
      if (result.updated) parts.push(`${result.updated} updated`);
      if (result.removed) parts.push(`${result.removed} removed`);
      setStatus(parts.length ? parts.join(", ") + (result.laidOut ? ", laid out" : "") : null);
    }, TYPING_DEBOUNCE_MS);
  };

  const nodeCount = text.split("\n").filter((l) => l.trim() && !l.trim().startsWith("#")).length;

  return (
    <div className="diagram-text island">
      <header className="diagram-text-head">
        <div>
          <strong>Diagram as text</strong>
          <span className="hint">Edit either side — they stay in sync</span>
        </div>
        <Tooltip label="Close" shortcut="⌘/" placement="bottom">
          <button className="icon-button" aria-label="Close text panel" onClick={onClose}>
            <IconClose />
          </button>
        </Tooltip>
      </header>

      <textarea
        ref={textareaRef}
        className="diagram-text-input"
        value={text}
        placeholder={PLACEHOLDER}
        spellCheck={false}
        aria-label="Diagram source"
        onFocus={() => {
          focusedRef.current = true;
        }}
        onBlur={() => {
          focusedRef.current = false;
        }}
        onChange={(event) => {
          setText(event.target.value);
          scheduleApply(event.target.value);
        }}
        onKeyDown={(event) => {
          // the canvas shortcuts must not fire while typing here
          event.stopPropagation();
          if (event.key === "Escape") {
            event.preventDefault();
            textareaRef.current?.blur();
          }
        }}
      />

      <footer className="diagram-text-foot">
        {issues.length > 0 ? (
          <ul className="diagram-issues">
            {issues.slice(0, 4).map((issue) => (
              <li key={`${issue.line}-${issue.message}`}>
                <span className="issue-line">line {issue.line}</span>
                {issue.message}
              </li>
            ))}
          </ul>
        ) : (
          <span className="hint">
            {status ?? `${nodeCount} line${nodeCount === 1 ? "" : "s"}`}
          </span>
        )}
      </footer>
    </div>
  );
};
