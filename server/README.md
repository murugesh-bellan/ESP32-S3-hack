# Tiny Tennis Railway relay

This small Node service serves the built `tiny-tennis/` browser game and relays Arduino gesture events over WebSockets.

## Local run

From the repository root:

```bash
npm install
npm run build
npm start
```

The game is served at `http://localhost:8080/`. Keyboard controls always remain available. A browser joins a controller room by opening `/?room=DEMO`; when `room` is present, the browser automatically runs the WebSocket adapter alongside the keyboard adapter.

## Arduino protocol

Connect each controller to:

```text
wss://YOUR-RAILWAY-DOMAIN/ws
```

First send a join message. Assigning a player explicitly is recommended:

```json
{"type":"join","role":"controller","room":"DEMO","player":1}
```

Then send one gesture per recognized swing:

```json
{"type":"gesture","gesture":"forehand","strength":82,"probability":0.94}
```

The server accepts `forehand`, `backhand` and `serve`; clamps strength to `0–100`, clamps probability to `0–1`, assigns the controller's player slot, and broadcasts a normalized `shot` event to the browser:

```json
{
  "type":"shot",
  "player":1,
  "gesture":"forehand",
  "strength":82,
  "power":0.82,
  "probability":0.94,
  "confidence":0.94,
  "sequence":7,
  "timestamp":1725020000000
}
```

`probability` is classifier confidence, not shot strength. The game can later reject low-confidence events or turn them into mishits. Direction is intentionally `0` until a future gyro-derived field is added.

Set `CONTROLLER_TOKEN` as a Railway variable if you want controllers to include a shared `token` in their join message.

## Railway settings

Deploy from the repository root. The root `package.json`, `package-lock.json`, `railway.json`, and `server/` directory must be committed and pushed; Railway cannot build files that exist only as uncommitted local changes. Do not configure `tiny-tennis/` as Railway's root directory.

The root `railway.json` already specifies:

- build: `npm run build`
- start: `npm start`
- health check: `/health`

Railway supplies the `PORT` environment variable. Do not hard-code it in deployment.
