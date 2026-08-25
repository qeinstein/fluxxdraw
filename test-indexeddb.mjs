import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import "fake-indexeddb/auto"; // We need fake-indexeddb

const ydoc = new Y.Doc();
const elements = ydoc.getMap("elements");
const order = ydoc.getArray("order");

elements.set("test", { id: "test", name: "hello" });
order.push(["test"]);

console.log("Before DB:", order.toArray());

const persistence = new IndexeddbPersistence("new-empty-db", ydoc);
persistence.on("synced", () => {
  console.log("After DB synced:", order.toArray());
  process.exit(0);
});
