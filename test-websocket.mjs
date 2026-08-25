import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";

const doc1 = new Y.Doc();
const doc2 = new Y.Doc();

const provider1 = new WebsocketProvider("wss://demos.yjs.dev/ws", "test-room-fluxxdraw123", doc1);
const provider2 = new WebsocketProvider("wss://demos.yjs.dev/ws", "test-room-fluxxdraw123", doc2);

doc1.getArray("test").push(["hello"]);

provider2.on("sync", (isSynced) => {
  if (isSynced) {
    console.log("Synced via Websocket!", doc2.getArray("test").toArray());
    process.exit(0);
  }
});

setTimeout(() => {
  console.log("Failed to sync via Websocket.");
  process.exit(1);
}, 5000);
