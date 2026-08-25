import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { IndexeddbPersistence } from "y-indexeddb";

// The shared Yjs document
export const ydoc = new Y.Doc();

// The map of all elements by ID
export const yElements = ydoc.getMap<any>("elements");
// The ordered list of element IDs (z-index)
export const yOrder = ydoc.getArray<string>("order");
// Map for storing binary files (images)
export const yFiles = ydoc.getMap<any>("files");
// Map for storing component definitions
export const yComponents = ydoc.getMap<any>("components");

export interface PeerPresence {
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  selection?: string[];
}

class CollaborationManager {
  provider: WebrtcProvider | null = null;
  persistence: IndexeddbPersistence | null = null;
  room: string | null = null;
  /** The full shareable URL for the current room, kept so the dialog can recall it */
  shareUrl: string | null = null;
  
  initLocalDB() {
    // Always persist the local document to IndexedDB so work isn't lost
    this.persistence = new IndexeddbPersistence("fluxxdraw-local-db", ydoc);
  }

  joinRoom(roomId: string, key: string, name: string, color: string) {
    // If we're already in this room, don't re-join
    if (this.room === roomId && this.provider) return;
    
    // Leave any existing room first
    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
    }

    this.room = roomId;
    this.shareUrl = `${window.location.origin}${window.location.pathname}#room=${roomId}&key=${key}`;
    
    // Switch IndexedDB persistence to a room-specific key so each session
    // has its own persistent state and doesn't conflict with local solo data
    if (this.persistence) {
      this.persistence.destroy();
    }
    this.persistence = new IndexeddbPersistence(`fluxxdraw-room-${roomId}`, ydoc);

    // Connect to WebRTC — only use the official Yjs signaling server
    this.provider = new WebrtcProvider(roomId, ydoc, {
      password: key,
      signaling: ["wss://signaling.yjs.dev"]
    });

    // When WebRTC syncs for the first time, force a re-read of the Yjs state
    // into the store so the joiner sees the host's canvas immediately.
    // We do this with a tiny transact that triggers the store's ydoc "update" listener.
    this.provider.on("synced", () => {
      ydoc.transact(() => {
        // no-op transaction — the transact itself triggers the "update" event
      }, "sync-refresh");
    });

    // Set initial presence
    this.updatePresence({ name, color });
  }

  leaveRoom() {
    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
    }
    this.room = null;
    this.shareUrl = null;
  }

  updatePresence(state: Partial<PeerPresence>) {
    if (!this.provider) return;
    const current = this.provider.awareness.getLocalState() as PeerPresence || {};
    this.provider.awareness.setLocalState({ ...current, ...state });
  }

  getPeers(): Map<number, PeerPresence> {
    if (!this.provider) return new Map();
    const states = this.provider.awareness.getStates() as Map<number, PeerPresence>;
    const peers = new Map<number, PeerPresence>();
    states.forEach((state, clientId) => {
      if (clientId !== this.provider!.awareness.clientID && state.name) {
        peers.set(clientId, state);
      }
    });
    return peers;
  }
}

export const collab = new CollaborationManager();
collab.initLocalDB();

export const parseCollaborationHash = () => {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.slice(1);
  const params = new URLSearchParams(hash);
  const room = params.get("room");
  const key = params.get("key");
  if (room && key) return { room, key };
  return null;
};

export const generateCollaborationLink = () => {
  const room = Math.random().toString(36).substring(2, 10);
  const key = Math.random().toString(36).substring(2, 15);
  return { room, key, url: `${window.location.origin}${window.location.pathname}#room=${room}&key=${key}` };
};

