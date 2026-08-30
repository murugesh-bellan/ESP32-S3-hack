import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";

const SERVER_ROOT = path.dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = path.resolve(SERVER_ROOT, "..");
const GAME_ROOT = path.join(REPOSITORY_ROOT, "tiny-tennis");
const PORT = Number(process.env.PORT || 8080);
const MAX_MESSAGE_BYTES = 16 * 1024;
const GESTURES = new Set(["forehand", "backhand", "serve"]);
const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mp3": "audio/mpeg",
  ".mov": "video/quicktime",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".wav": "audio/wav",
};

const rooms = new Map();
const webSocketServer = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });

function send(socket, message) {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  }
}

function broadcast(room, message, except) {
  for (const client of room.clients) {
    if (client !== except) {
      send(client.socket, message);
    }
  }
}

function getRoom(roomCode) {
  let room = rooms.get(roomCode);
  if (!room) {
    room = { clients: new Set(), controllers: new Map(), sequence: 0 };
    rooms.set(roomCode, room);
  }
  return room;
}

function removeClient(client) {
  if (!client.room) {
    return;
  }

  const room = client.room;
  room.clients.delete(client);
  if (client.player) {
    room.controllers.delete(client.player);
    broadcast(room, { type: "controller-left", player: client.player });
  }
  if (room.clients.size === 0) {
    rooms.delete(client.roomCode);
  }
}

function normalizedRoom(value) {
  if (typeof value !== "string") {
    return undefined;
  }

  const room = value.trim().toUpperCase();
  return /^[A-Z0-9_-]{2,24}$/.test(room) ? room : undefined;
}

function normalizedPlayer(value) {
  return value === 1 || value === 2 ? value : undefined;
}

function normalizedNumber(value, minimum, maximum) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return undefined;
  }
  return Math.min(maximum, Math.max(minimum, value));
}

function joinRoom(client, message) {
  if (client.room) {
    send(client.socket, { type: "error", code: "already-joined", message: "This connection already joined a room." });
    return;
  }

  const roomCode = normalizedRoom(message.room);
  const role = message.role === "browser" || message.role === "controller" ? message.role : undefined;
  if (!roomCode || !role) {
    send(client.socket, { type: "error", code: "invalid-join", message: "Join requires a valid room and role." });
    return;
  }

  if (role === "controller" && process.env.CONTROLLER_TOKEN && message.token !== process.env.CONTROLLER_TOKEN) {
    send(client.socket, { type: "error", code: "unauthorized", message: "Invalid controller token." });
    client.socket.close(1008, "Unauthorized");
    return;
  }

  const room = getRoom(roomCode);
  let player;
  if (role === "controller") {
    const requestedPlayer = normalizedPlayer(message.player);
    player = requestedPlayer ?? ([1, 2].find((candidate) => !room.controllers.has(candidate)));
    if (!player || room.controllers.has(player)) {
      send(client.socket, { type: "error", code: "player-unavailable", message: "Both controller slots are already occupied." });
      return;
    }
    room.controllers.set(player, client);
  }

  client.room = room;
  client.roomCode = roomCode;
  client.role = role;
  client.player = player;
  room.clients.add(client);
  send(client.socket, { type: "joined", room: roomCode, role, player: player ?? null });
  broadcast(room, { type: "participant-joined", role, player: player ?? null }, client);
}

function handleControllerMessage(client, message) {
  if (!client.room || client.role !== "controller") {
    send(client.socket, { type: "error", code: "not-controller", message: "Join as a controller before sending gestures." });
    return;
  }

  const gestureValue = typeof message.gesture === "string" ? message.gesture : message.classification;
  const gesture = typeof gestureValue === "string" ? gestureValue.trim().toLowerCase() : undefined;
  const strength = normalizedNumber(message.strength, 0, 100);
  const probabilityValue = message.probability ?? message.confidence;
  const probability = normalizedNumber(probabilityValue, 0, 1);
  if (!GESTURES.has(gesture) || strength === undefined || probability === undefined) {
    send(client.socket, {
      type: "error",
      code: "invalid-gesture",
      message: "Gesture messages require forehand/backhand/serve, strength 0-100 and probability 0-1.",
    });
    return;
  }

  const room = client.room;
  room.sequence += 1;
  broadcast(room, {
    type: "shot",
    player: client.player,
    gesture,
    strength,
    power: strength / 100,
    probability,
    confidence: probability,
    sequence: room.sequence,
    timestamp: Date.now(),
  }, client);
}

webSocketServer.on("connection", (socket) => {
  const client = { socket, room: undefined, roomCode: undefined, role: undefined, player: undefined };

  socket.on("message", (rawMessage) => {
    let message;
    try {
      message = JSON.parse(rawMessage.toString());
    } catch {
      send(socket, { type: "error", code: "invalid-json", message: "Message must be valid JSON." });
      return;
    }

    if (!message || typeof message !== "object") {
      send(socket, { type: "error", code: "invalid-message", message: "Message must be a JSON object." });
      return;
    }

    if (message.type === "join") {
      joinRoom(client, message);
      return;
    }

    if (message.type === "gesture") {
      handleControllerMessage(client, message);
      return;
    }

    send(socket, { type: "error", code: "unknown-message", message: "Supported messages are join and gesture." });
  });

  socket.on("close", () => removeClient(client));
  socket.on("error", () => removeClient(client));
});

const server = http.createServer(async (request, response) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (requestUrl.pathname === "/health") {
    response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ ok: true, rooms: rooms.size }));
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { Allow: "GET, HEAD" });
    response.end();
    return;
  }

  const relativePath = requestUrl.pathname === "/" ? "index.html" : requestUrl.pathname.slice(1);
  const filePath = path.resolve(GAME_ROOT, relativePath);
  if (!filePath.startsWith(`${GAME_ROOT}${path.sep}`)) {
    response.writeHead(400);
    response.end("Invalid path");
    return;
  }

  try {
    const file = await readFile(filePath);
    response.writeHead(200, {
      "Cache-Control": requestUrl.pathname.startsWith("/dist/") ? "no-cache" : "public, max-age=3600",
      "Content-Length": file.byteLength,
      "Content-Type": MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream",
    });
    if (request.method === "HEAD") {
      response.end();
    } else {
      response.end(file);
    }
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.on("upgrade", (request, socket, head) => {
  const requestUrl = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
  if (requestUrl.pathname !== "/ws") {
    socket.destroy();
    return;
  }

  webSocketServer.handleUpgrade(request, socket, head, (client) => {
    webSocketServer.emit("connection", client, request);
  });
});

const heartbeat = setInterval(() => {
  for (const client of webSocketServer.clients) {
    if (client.isAlive === false) {
      client.terminate();
      continue;
    }
    client.isAlive = false;
    client.ping();
  }
}, 30_000);

webSocketServer.on("connection", (socket) => {
  socket.isAlive = true;
  socket.on("pong", () => {
    socket.isAlive = true;
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Tiny Tennis relay listening on port ${PORT}`);
});

function shutdown() {
  clearInterval(heartbeat);
  server.close(() => process.exit(0));
  webSocketServer.close();
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
