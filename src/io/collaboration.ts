import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { IndexeddbPersistence } from "y-indexeddb";
import { store } from "../store";
import { promptForInput } from "../prompt";
import { saveWithPicker } from "./fileSystem";
import { serializeScene, sceneToJson } from "./serialize";
import { FILE_EXTENSION } from "../constants";

export type SessionState = "LOCAL" | "CREATING_SESSION" | "COLLABORATING" | "JOINING_SESSION";

const collaborationRelay =
  import.meta.env.VITE_WS_URL ?? import.meta.env.VITE_YJS_RELAY_URL ?? "wss://fluxxdraw.onrender.com";

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
  unsubscribeStore?: () => void;
  private awarenessListeners = new Set<() => void>();
  
  subscribeAwareness = (listener: () => void) => {
    this.awarenessListeners.add(listener);
    return () => { this.awarenessListeners.delete(listener); };
  };
  
  private emitAwarenessChange() {
    for (const listener of this.awarenessListeners) listener();
  }
  
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
    
    this.collabDoc.getMap<boolean>("meta").set("isRoomActive", true);
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
      // We don't persist the room specifically because the local doc is already persisted and autosaved, 
      // and IndexeddbPersistence can cause issues with WebsocketProvider initialization and Yjs client IDs.
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

    let lastSelection = store.appState.selectedIds;
    this.unsubscribeStore = store.subscribe(() => {
      if (store.appState.selectedIds !== lastSelection) {
        lastSelection = store.appState.selectedIds;
        this.updatePresence({ selection: lastSelection });
      }
    });

    // Emit awareness changes to specific listeners instead of forcing the whole store to re-render
    this.provider.awareness.on("change", () => {
      this.emitAwarenessChange();
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
          // Wait 15 seconds to allow for slow awareness sync over the network.
          setTimeout(() => {
            const yMeta = this.collabDoc?.getMap<boolean>("meta");
            const isRoomActive = yMeta ? yMeta.get("isRoomActive") : false;
            if (this.state === "COLLABORATING" && !isRoomActive && this.provider!.awareness.getStates().size <= 1) {
              window.dispatchEvent(new CustomEvent("fluxxdraw:alert", { detail: "This session no longer exists or the host has left." }));
              this.leaveSession();
            }
          }, 15000);
        }
      }
    });

    const yMeta = this.collabDoc!.getMap<boolean>("meta");
    yMeta.observe(() => {
      if (yMeta.get("ended") === true && !this.isHost) {
        window.dispatchEvent(new CustomEvent("fluxxdraw:alert", { detail: "The host has ended this collaboration session." }));
        this.leaveSession("The host has ended the session.");
      }
    });
  }

  private promptToSaveSession(reason: string) {
    if (store.elements.length === 0) return;
    
    // Capture state immediately before it is destroyed by leaveSession
    const doc = serializeScene(store.elements, store.files, store.appState, [], store.components);
    
    setTimeout(async () => {
      const fileName = await promptForInput({
        title: "Session Ended",
        label: `${reason} Do you want to save a local copy?`,
        hint: `Leave blank to discard, or enter a name to download as .${FILE_EXTENSION}`,
        initialValue: "collaborative-drawing"
      });

      if (fileName) {
        const json = sceneToJson(doc);
        const blob = new Blob([json], { type: "application/json" });
        const suggested = `${fileName.replace(/\.[^.]+$/, "")}.${FILE_EXTENSION}`;
        try {
          await saveWithPicker(blob, suggested, [
            {
              description: "Drawing",
              accept: { "application/json": [`.${FILE_EXTENSION}`, ".excalidraw", ".json"] },
            },
          ]);
        } catch (e) {
          console.error("Failed to save session", e);
        }
      }
    }, 100);
  }

  leaveSession(reason: string = "You left the session.") {
    if (this.state === "COLLABORATING" && !this.isHost) {
      this.promptToSaveSession(reason);
    }

    if (this.provider) {
      this.provider.destroy();
      this.provider = null;
    }
    if (this.roomPersistence) {
      this.roomPersistence.destroy();
      this.roomPersistence = null;
    }
    if (this.unsubscribeStore) {
      this.unsubscribeStore();
      this.unsubscribeStore = undefined;
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
      this.collabDoc.getMap<boolean>("meta").set("isRoomActive", false);
      
      // Save the final state back to the local document BEFORE tearing down
      const finalState = Y.encodeStateAsUpdate(this.collabDoc);
      Y.applyUpdate(this.localDoc, finalState);
    }
    // Give Yjs a moment to broadcast the 'ended' message
    setTimeout(() => {
      this.leaveSession();
    }, 2000);
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
