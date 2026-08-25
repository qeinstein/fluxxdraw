import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";

const doc1 = new Y.Doc();
const doc2 = new Y.Doc();

const provider1 = new WebrtcProvider("test-room-fluxx", doc1, { signaling: ["wss://signaling.yjs.dev"] });
const provider2 = new WebrtcProvider("test-room-fluxx", doc2, { signaling: ["wss://signaling.yjs.dev"] });

doc1.getArray("test").push(["hello"]);

setTimeout(() => {
  console.log("doc2 array:", doc2.getArray("test").toArray());
  process.exit(0);
}, 3000);
