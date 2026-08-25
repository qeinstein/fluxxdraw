import { nanoid } from "nanoid";
import type { SceneDocument } from "./types";

const RECENT_KEY = "fluxxdraw:recent_documents";
const RECOVERY_KEY = "fluxxdraw:recovery_snapshots";
const COMMENTS_KEY = "fluxxdraw:comments";
let lastRecovery = 0;

export interface StoredDocument {
  id: string;
  name: string;
  updatedAt: number;
  document: SceneDocument;
}

export interface CanvasComment {
  id: string;
  elementId: string | null;
  x: number;
  y: number;
  text: string;
  createdAt: number;
}

const read = <T>(key: string, fallback: T): T => {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "") as T;
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Local workspace history is best-effort when image-heavy scenes fill quota.
  }
};

export const getRecentDocuments = () => read<StoredDocument[]>(RECENT_KEY, []);

export const recordRecentDocument = (name: string, document: SceneDocument) => {
  const existing = getRecentDocuments().filter((item) => item.name !== name);
  write(RECENT_KEY, [{ id: nanoid(), name, updatedAt: Date.now(), document }, ...existing].slice(0, 8));
};

export const getRecoverySnapshots = () => read<StoredDocument[]>(RECOVERY_KEY, []);

export const recordRecoverySnapshot = (name: string, document: SceneDocument, force = false) => {
  const now = Date.now();
  if (!force && now - lastRecovery < 60_000) return;
  lastRecovery = now;
  const snapshots = getRecoverySnapshots();
  write(RECOVERY_KEY, [
    { id: nanoid(), name, updatedAt: now, document },
    ...snapshots,
  ].slice(0, 6));
};

export const deleteRecoverySnapshot = (id: string) => {
  write(RECOVERY_KEY, getRecoverySnapshots().filter((item) => item.id !== id));
};

export const getCanvasComments = () => read<CanvasComment[]>(COMMENTS_KEY, []);

export const addCanvasComment = (comment: Omit<CanvasComment, "id" | "createdAt">) => {
  const next = { ...comment, id: nanoid(), createdAt: Date.now() };
  write(COMMENTS_KEY, [next, ...getCanvasComments()]);
  return next;
};

export const deleteCanvasComment = (id: string) => {
  write(COMMENTS_KEY, getCanvasComments().filter((comment) => comment.id !== id));
};
