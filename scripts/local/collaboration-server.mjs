import http from "node:http";

import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import { WebSocketServer } from "ws";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";
import * as Y from "yjs";

const messageSync = 0;
const messageAwareness = 1;
const webSocketOpen = 1;

class RelayDocument {
  ydoc = new Y.Doc();
  awareness = new awarenessProtocol.Awareness(this.ydoc);
  connections = new Set();

  add(connection) {
    this.connections.add(connection);
  }

  remove(connection) {
    this.connections.delete(connection);
    if (connection.clientId !== null) {
      awarenessProtocol.removeAwarenessStates(
        this.awareness,
        [connection.clientId],
        null,
      );
    }
  }

  handleSync(data) {
    const decoder = decoding.createDecoder(data);
    decoding.readVarUint(decoder);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageSync);
    syncProtocol.readSyncMessage(decoder, encoder, this.ydoc, null);
    return encoding.length(encoder) > 1 ? encoding.toUint8Array(encoder) : null;
  }

  handleAwareness(connection, data) {
    const decoder = decoding.createDecoder(data);
    decoding.readVarUint(decoder);
    const update = decoding.readVarUint8Array(decoder);
    const firstClientId = decodeFirstClientId(update);
    awarenessProtocol.applyAwarenessUpdate(this.awareness, update, null);
    connection.clientId = connection.clientId ?? firstClientId;
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, messageAwareness);
    encoding.writeUint8Array(encoder, update);
    return encoding.toUint8Array(encoder);
  }
}

function decodeFirstClientId(update) {
  const decoder = decoding.createDecoder(update);
  const clientCount = decoding.readVarUint(decoder);
  if (clientCount === 0) return null;
  const clientId = decoding.readVarUint(decoder);
  decoding.readVarUint(decoder);
  decoding.readVarString(decoder);
  return clientId;
}

const documents = new Map();
const port = Number(process.env.PORT || 1234);
const relayUrl = process.env.RENDER_EXTERNAL_URL || `http://127.0.0.1:${port}`;
const server = http.createServer((_request, response) => {
  if (new URL(_request.url, "http://localhost").pathname === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "ok", rooms: documents.size }));
    return;
  }
  response.writeHead(204);
  response.end();
});
const wss = new WebSocketServer({ server });

setInterval(() => {
  http
    .get(`${relayUrl}/health`)
    .on("error", () => {});
}, 60_000);

wss.on("connection", (connection, request) => {
  const roomName = new URL(request.url, "http://localhost").pathname.slice(1);
  let relayDocument = documents.get(roomName);
  if (!relayDocument) {
    relayDocument = new RelayDocument();
    documents.set(roomName, relayDocument);
  }
  relayDocument.add(connection);
  connection.clientId = null;

  const broadcast = (data, exclude) => {
    for (const peer of relayDocument.connections) {
      if (peer !== exclude && peer.readyState === webSocketOpen) peer.send(data);
    }
  };

  connection.on("message", (data, isBinary) => {
    if (!isBinary) return;
    const messageType = data[0];
    if (messageType === messageSync) {
      const response = relayDocument.handleSync(data);
      if (response?.length > 0) connection.send(response);
      broadcast(data, connection);
    } else if (messageType === messageAwareness) {
      const response = relayDocument.handleAwareness(connection, data);
      if (response.length > 0) broadcast(response, connection);
    }
  });

  connection.on("close", () => {
    relayDocument.remove(connection);
  });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Yjs collaboration relay on port ${port} — self-ping to ${relayUrl}/health every 60s`);
});
