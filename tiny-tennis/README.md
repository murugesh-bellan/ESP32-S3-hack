# Tiny Tennis game

Tiny Tennis is a Phaser browser game with three modes:

- **Practice Wall:** untimed rally practice. The ball must be reached and returned; hits, misses, shot labels, trails and impact effects make timing visible.
- **Play Computer:** a tennis game against the computer with Love/15/30/40 scoring, deuce, advantage and game announcements.
- **Two Players:** two local players can share a keyboard. The same game can receive Player 1/2 shots from ESP32 controllers through the root WebSocket relay.

## Controls

Player 1:

```text
F       forehand
B       two-handed backhand
S       serve
A / D   aim left / right
Space   soft shot (hold while pressing a shot key)
Shift   hard shot modifier
Esc     return to menu
```

Player 2 (local two-player mode):

```text
←       backhand
→       forehand
↑       serve
J / L   aim left / right
```

The ball has a real travel window. A shot pressed too early, too late, or with the wrong stroke is a miss; successful returns travel back across the net. Strength affects power and therefore timing/trajectory.

## Controller mode

The browser always starts the keyboard adapter. If the URL contains a room, for example `?room=DEMO`, it also starts the WebSocket adapter. The relay forwards Arduino messages as normalized game actions:

```text
TinyML IMU gesture → { gesture, strength, probability }
                  → Railway relay
                  → { player, type, power, confidence }
                  → Phaser ball + player animation + score
```

The trained Arduino TinyML model supplies the shot classification (`forehand`, `backhand`, `serve`) and confidence. The IMU-derived strength becomes shot power. Direction is currently neutral for hardware input; gyro-derived aiming can be added later without changing the transport contract.

When a room is active, the top of the game screen shows `CONNECTING`, `CONNECTED`, or `OFFLINE`. After each Arduino shot it displays the player, stroke and power, so you can verify the complete link without opening developer tools.

## Run locally

From the repository root:

```bash
npm install
npm run build
npm start
```

Then open `http://localhost:8080/`. For controller-room testing, open `http://localhost:8080/?room=DEMO`. See the root [README](../README.md) and [`../server/README.md`](../server/README.md) for Railway and Arduino setup.

## Audio and assets

The game uses the supplied audio assets for menu/practice music, ball hits, bounces, out balls and match wins. Additional art can be added under `assets/` and `public/assets/` without changing the controller protocol.
