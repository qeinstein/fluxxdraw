import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { IndexeddbPersistence } from "y-indexeddb";
import { store } from "../store";

export type SessionState = "LOCAL" | "CREATING_SESSION" | "COLLABORATING" | "JOINING_SESSION";

const collaborationRelay =
  import.meta.env.VITE_YJS_RELAY_URL ?? "wss://demos.yjs.dev/ws";

export interface PeerPresence {
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  selection?: string[];
}

class CollaborationManager {
  localDoc = new Y.Doc();
  localPersistence: IndexeddbPersistence | null = null;

  collabDoc: Y.Doc | null = null;
  provider: WebsocketProvider | null = null;
  roomPersistence: IndexeddbPersistence | null = null;

  room: string | null = null;
  shareUrl: string | null = null;
  isHost: boolean = false;
  state: SessionState = "LOCAL";
  
  initLocalDB() {
    this.localPersistence = new IndexeddbPersistence("fluxxdraw-local-db", this.localDoc);
    store.bindYdoc(this.localDoc);
  }

  startSession(roomId: string, name: string, color: string) {
    if (this.state !== "LOCAL") return;
    this.state = "CREATING_SESSION";
    
    this.collabDoc = new Y.Doc();
    
    // Seed exactly once by the creator
    const state = Y.encodeStateAsUpdate(this.localDoc);
    Y.applyUpdate(this.collabDoc, state);
    
    this.isHost = true;
    this._connect(roomId, name, color);
  }

  joinSession(roomId: string, name: string, color: string) {
    if (this.state !== "LOCAL") return;
    this.state = "JOINING_SESSION";
    
    this.collabDoc = new Y.Doc();
    this.isHost = false;
    this._connect(roomId, name, color);
  }

  private _connect(roomId: string, name: string, color: string) {
    this.room = roomId;
    this.shareUrl = `${window.location.origin}/session/${roomId}`;
    
    if (this.isHost) {
      // Keep a room's document available when an installed PWA reopens it.
      this.roomPersistence = new IndexeddbPersistence(`fluxxdraw-room-${roomId}`, this.collabDoc!);
    }

    // Connect through the Yjs WebSocket relay.
    this.provider = new WebsocketProvider(
      collaborationRelay,
      roomId,
      this.collabDoc!,
    );

    // Bind store to the new collab document
    store.bindYdoc(this.collabDoc!);

    // Set initial presence
    this.updatePresence({ name, color });

    // Re-render canvas when peer cursors or presence updates
    this.provider.awareness.on("change", () => {
      store.emit();
    });

    this.provider.on('sync', (isSynced: boolean) => {
      if (isSynced) {
        this.state = "COLLABORATING";
        store.emit();

        if (!this.isHost) {
          // Auto-pan to center of the drawing once elements sync
          let hasAutoPanned = false;
          const tryAutoPan = () => {
            if (!hasAutoPanned && store.elements.length > 0) {
              hasAutoPanned = true;
              import("../components/ZoomControls").then(({ zoomToFit }) => {
                setTimeout(() => zoomToFit("all"), 100);
              });
            }
          };

          tryAutoPan();
          if (!hasAutoPanned) {
            const updateHandler = () => {
              tryAutoPan();
              if (hasAutoPanned) this.collabDoc?.off("update", updateHandler);
            };
            this.collabDoc?.on("update", updateHandler);
          }

          // If a guest joins an empty room with no host, they should be kicked with a popup.
          // Wait 10 seconds to allow for slow awareness sync over the network.
          setTimeout(() => {
            if (this.state === "COLLABORATING" && this.provider!.awareness.getStates().size <= 1 && store.elements.length === 0) {
              window.dispatchEvent(new CustomEvent("fluxxdraw:alert", { detail: "This session no longer exists or the host has left." }));
              this.leaveSession();
            }
          }, 10000);
        }
      }
    });

    const yMeta = this.collabDoc!.getMap<boolean>("meta");
    yMeta.observe(() => {
      if (yMeta.get("ended") === true && !this.isHost) {
        alert("The host has ended this collaboration session.");
        this.leaveSession();
      }
    });
  }

  leaveSession() {
    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
    }
    if (this.roomPersistence) {
      this.roomPersistence.destroy();
      this.roomPersistence = null;
    }
    if (this.collabDoc) {
      this.collabDoc.destroy();
      this.collabDoc = null;
    }
    this.room = null;
    this.shareUrl = null;
    this.isHost = false;
    this.state = "LOCAL";
    
    // Restore local document
    store.bindYdoc(this.localDoc);
    
    const newPath = window.location.pathname.replace(/\/session\/[A-Za-z0-9]+/, '') || '/';
    window.history.replaceState(null, "", newPath);
  }

  endSession() {
    if (this.isHost && this.collabDoc) {
      this.collabDoc.getMap<boolean>("meta").set("ended", true);
    }
    // Give Yjs a moment to broadcast the 'ended' message
    setTimeout(() => {
      this.leaveSession();
    }, 1000);
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
// NOTE: We don't call initLocalDB() here because store imports collab, which would cause a circular dependency.
// It is explicitly called during initialization in App.tsx or main.tsx.

export const parseCollaborationPath = () => {
  if (typeof window === "undefined") return null;
  const match = window.location.pathname.match(/^\/session\/([A-Za-z0-9]+)$/);
  if (!match) return null;
  return { room: match[1] };
};

export const generateCollaborationLink = () => {
  const room = Math.random().toString(36).substring(2, 10);
  return { room, url: `${window.location.origin}/session/${room}` };
};
