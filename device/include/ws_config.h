#pragma once

// Railway WebSocket relay (owned by the game-server teammate).
// No auth on this connection - public server, wss:// (TLS).

#define WS_HOST "humorous-youth-production.up.railway.app"
#define WS_PORT 443
#define WS_PATH "/ws"
#define WS_USE_TLS true

// server/index.js requires a join handshake ({"type":"join","role":"controller",
// "room":...,"player":...}) before it will accept "gesture" messages from this
// connection - room must match the browser's ?room= query param to land in
// the same game session. No token needed (CONTROLLER_TOKEN isn't set on the
// deployed service).
#define WS_ROOM "DEMO1"
#define WS_PLAYER 1
