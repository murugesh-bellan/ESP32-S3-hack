#pragma once

// Railway WebSocket relay (owned by the game-server teammate).
// No auth on this connection - public server, wss:// (TLS).

#define WS_HOST "humorous-youth-production.up.railway.app"
#define WS_PORT 443
#define WS_PATH "/ws"
#define WS_USE_TLS true
