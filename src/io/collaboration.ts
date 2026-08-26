import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
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
// Meta map for session state (e.g. session ended)
export const yMeta = ydoc.getMap<boolean>("meta");

const collaborationRelay =
  import.meta.env.VITE_YJS_RELAY_URL ?? "ws://127.0.0.1:1234";

export interface PeerPresence {
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  selection?: string[];
}

class CollaborationManager {
  provider: WebsocketProvider | null = null;
  persistence: IndexeddbPersistence | null = null;
  room: string | null = null;
  /** The full shareable URL for the current room, kept so the dialog can recall it */
  shareUrl: string | null = null;
  isHost: boolean = false;
  
  initLocalDB() {
    // Always persist the local document to IndexedDB so work isn't lost
    this.persistence = new IndexeddbPersistence("fluxxdraw-local-db", ydoc);
  }

  joinRoom(roomId: string, key: string, name: string, color: string, isHost: boolean = false) {
    // If we're already in this room, don't re-join
    if (this.room === roomId && this.provider) return;
    
    // Leave any existing room first
    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
    }
    if (this.persistence) {
      this.persistence.destroy();
      this.persistence = null;
    }

    this.room = roomId;
    this.isHost = isHost;
    this.shareUrl = `${window.location.origin}${window.location.pathname}#room=${roomId}&key=${key}`;
    
    // Keep a room's document available when an installed PWA reopens it.
    this.persistence = new IndexeddbPersistence(`fluxxdraw-room-${roomId}`, ydoc);

    // Connect through the Yjs WebSocket relay. The key scopes the room name;
    // clients must send it to the relay, so it is not a secret there.
    this.provider = new WebsocketProvider(
      collaborationRelay,
      `${roomId}-${key}`,
      ydoc,
    );

    // Set initial presence
    this.updatePresence({ name, color });

    // Listen for session end from host
    yMeta.observe(() => {
      console.log("yMeta observed change:", yMeta.get("ended"), "isHost:", this.isHost);
      if (yMeta.get("ended") === true && !this.isHost) {
        alert("The host has ended this collaboration session.");
        this.leaveRoom();
        window.history.replaceState(null, "", window.location.pathname);
        window.location.reload();
      }
    });
  }

  leaveRoom() {
    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
    }
    this.room = null;
    this.shareUrl = null;
    this.isHost = false;
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
