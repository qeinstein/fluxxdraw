import { nanoid } from "nanoid";
import type { ExcaliElement } from "../types";

/**
 * Durable, in-file version history.
 *
 * This is deliberately separate from undo/redo. Undo/redo is a volatile
 * in-session stack; this is a permanent record that gets written into the
 * `.fluxx` file, so a drawing carries its own past wherever it goes.
 *
 * Storage is delta-based: a full keyframe every `KEYFRAME_INTERVAL`
 * checkpoints, and only changed/removed elements in between. Because the store
 * treats elements as immutable, "changed" is a reference comparison.
 */

export interface Checkpoint {
  id: string;
  /** epoch milliseconds */
  t: number;
  label?: string;
  /** complete element list; present on keyframes only */
  keyframe?: ExcaliElement[];
  /** elements added or modified since the previous checkpoint */
  changed?: ExcaliElement[];
  /** ids deleted since the previous checkpoint */
  removed?: string[];
}

const KEYFRAME_INTERVAL = 25;

/** Edits closer together than this collapse into one checkpoint. */
const COALESCE_MS = 4000;

/** Upper bound on retained checkpoints; older ones are thinned, not dropped. */
const MAX_CHECKPOINTS = 600;

export class Timeline {
  checkpoints: Checkpoint[] = [];
  /** elements as of the newest checkpoint, for delta computation */
  private tip: ExcaliElement[] = [];

  get length() {
    return this.checkpoints.length;
  }

  load(checkpoints: Checkpoint[]) {
    this.checkpoints = checkpoints;
    this.tip = checkpoints.length ? this.reconstruct(checkpoints.length - 1) : [];
  }

  reset() {
    this.checkpoints = [];
    this.tip = [];
  }

  /**
   * Records the current scene. Returns true when a new checkpoint was appended
   * (as opposed to coalescing into the previous one).
   */
  record(elements: ExcaliElement[], now: number, label?: string): boolean {
    const live = elements.filter((el) => !el.isDeleted);
    const previous = this.checkpoints[this.checkpoints.length - 1];

    // nothing meaningful changed
    if (previous && !this.hasChanges(live)) return false;

    const coalesce =
      previous !== undefined &&
      !previous.label &&
      !label &&
      now - previous.t < COALESCE_MS &&
      this.checkpoints.length > 1;

    if (coalesce) {
      this.checkpoints.pop();
      // re-derive the tip so the replacement delta is relative to the right base
      this.tip = this.checkpoints.length
        ? this.reconstruct(this.checkpoints.length - 1)
        : [];
    }

    const index = this.checkpoints.length;
    const isKeyframe = index % KEYFRAME_INTERVAL === 0;

    const checkpoint: Checkpoint = isKeyframe
      ? { id: nanoid(8), t: now, label, keyframe: live }
      : { id: nanoid(8), t: now, label, ...this.delta(live) };

    this.checkpoints.push(checkpoint);
    this.tip = live;
    this.prune();
    return true;
  }

  /** Attaches a name to the most recent checkpoint, e.g. on save. */
  labelLatest(label: string) {
    const last = this.checkpoints[this.checkpoints.length - 1];
    if (last) last.label = label;
  }

  private hasChanges(live: ExcaliElement[]) {
    if (live.length !== this.tip.length) return true;
    const byId = new Map(this.tip.map((el) => [el.id, el]));
    return live.some((el) => byId.get(el.id) !== el);
  }

  private delta(live: ExcaliElement[]) {
    const previousById = new Map(this.tip.map((el) => [el.id, el]));
    const changed = live.filter((el) => previousById.get(el.id) !== el);
    const liveIds = new Set(live.map((el) => el.id));
    const removed = this.tip.filter((el) => !liveIds.has(el.id)).map((el) => el.id);
    return {
      ...(changed.length ? { changed } : {}),
      ...(removed.length ? { removed } : {}),
    };
  }

  /** Rebuilds the full element list as of `index`. */
  reconstruct(index: number): ExcaliElement[] {
    if (index < 0 || index >= this.checkpoints.length) return [];

    let start = index;
    while (start > 0 && !this.checkpoints[start].keyframe) start--;

    const base = this.checkpoints[start].keyframe ?? [];
    const byId = new Map(base.map((el) => [el.id, el]));
    // preserve z-order explicitly; a Map alone would reorder on re-set
    let order = base.map((el) => el.id);

    for (let i = start + 1; i <= index; i++) {
      const cp = this.checkpoints[i];
      if (cp.keyframe) {
        byId.clear();
        order = [];
        for (const el of cp.keyframe) {
          byId.set(el.id, el);
          order.push(el.id);
        }
        continue;
      }
      for (const id of cp.removed ?? []) {
        byId.delete(id);
        order = order.filter((existing) => existing !== id);
      }
      for (const el of cp.changed ?? []) {
        if (!byId.has(el.id)) order.push(el.id);
        byId.set(el.id, el);
      }
    }

    return order.map((id) => byId.get(id)!).filter(Boolean);
  }

  /**
   * Thins old checkpoints when the timeline grows too long: recent history
   * stays dense, older history keeps one entry per widening time bucket. The
   * timeline never simply forgets its beginning.
   */
  private prune() {
    if (this.checkpoints.length <= MAX_CHECKPOINTS) return;

    const keepDenseFrom = this.checkpoints.length - Math.floor(MAX_CHECKPOINTS / 2);
    const recent = this.checkpoints.slice(keepDenseFrom);
    const older = this.checkpoints.slice(0, keepDenseFrom);

    const budget = MAX_CHECKPOINTS - recent.length;
    const span = Math.max(older[older.length - 1].t - older[0].t, 1);
    const bucket = span / budget;

    const thinned: Checkpoint[] = [];
    let nextThreshold = -Infinity;
    for (const cp of older) {
      // always keep named checkpoints and the first entry
      if (cp.label || cp.t >= nextThreshold || thinned.length === 0) {
        thinned.push(cp);
        nextThreshold = cp.t + bucket;
      }
    }

    // dropping entries invalidates deltas, so rebuild the survivors as keyframes
    const rebuilt = thinned.map((cp) => {
      const index = this.checkpoints.indexOf(cp);
      return { ...cp, keyframe: this.reconstruct(index), changed: undefined, removed: undefined };
    });

    this.checkpoints = [...rebuilt, ...recent];
    // the first retained recent entry now needs a base it can rely on
    const seam = rebuilt.length;
    if (this.checkpoints[seam] && !this.checkpoints[seam].keyframe) {
      this.checkpoints[seam] = {
        ...this.checkpoints[seam],
        keyframe: this.reconstruct(seam),
        changed: undefined,
        removed: undefined,
      };
    }
  }
}

export interface ElementDiff {
  added: string[];
  removed: string[];
  changed: string[];
}

/** Compares two element lists by id and identity, for the diff view. */
export const diffElements = (
  before: ExcaliElement[],
  after: ExcaliElement[],
): ElementDiff => {
  const beforeById = new Map(before.map((el) => [el.id, el]));
  const afterById = new Map(after.map((el) => [el.id, el]));

  const added: string[] = [];
  const changed: string[] = [];
  for (const el of after) {
    const previous = beforeById.get(el.id);
    if (!previous) added.push(el.id);
    else if (previous.version !== el.version) changed.push(el.id);
  }
  const removed = before.filter((el) => !afterById.has(el.id)).map((el) => el.id);

  return { added, removed, changed };
};

/** "just now", "12 min ago", "3 hours ago"… for timeline labels. */
export const relativeTime = (from: number, now: number): string => {
  const seconds = Math.max(0, Math.round((now - from) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.round(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
};

export const formatClock = (t: number) =>
  new Date(t).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
