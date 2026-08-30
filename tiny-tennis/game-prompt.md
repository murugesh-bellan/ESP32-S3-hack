# Build a Wimbledon-Inspired 8-Bit Virtual Tennis Game

You are helping me build a hackathon game.

The game will eventually be controlled by two ESP32-S3 devices using IMU gesture recognition / TinyML, but **for now we are building and testing entirely with keyboard controls**.

The priority is:

1. Get a playable game working quickly.
2. Make the gameplay feel satisfying.
3. Make it visually memorable.
4. Keep the architecture clean enough that keyboard input can later be replaced by WebSocket messages from ESP32 devices.
5. Avoid unnecessary frameworks and complexity.

Do **not** try to implement the entire game at once.

Work milestone by milestone.

At the end of each milestone:

- make sure the game runs;
- tell me exactly what was implemented;
- list the files changed;
- tell me how to test it;
- STOP and wait for me before implementing the next milestone.

---

# 1. Technology

Use:

- Phaser 4.x
- TypeScript
- HTML5
- CSS
- esbuild
- npm

Do NOT use:

- Vite
- React
- Vue
- Three.js
- a frontend framework
- a backend server yet
- a physics library unless Phaser already provides what we need
- unnecessary dependencies

Keep the project small and hackathon-friendly.

Expected basic commands should be something approximately like:

```bash
npm install
npm run dev
npm run build
```

Use esbuild for bundling TypeScript.

A very small static development server may be added as a dev dependency if needed.

---

# 2. Game concept

Working title:

**Tiny Tennis**

Tagline:

**Real swings. Tiny AI. Big rallies.**

This is a two-player arcade tennis game inspired visually by:

- Wimbledon
- classic 8-bit / 16-bit sports games
- Game Boy / SNES-era tennis
- slightly exaggerated modern arcade-game feedback

Do NOT copy Wimbledon logos, branding or copyrighted game artwork.

The visual inspiration should instead come from:

- rich grass-green court
- crisp white lines
- dark-green surroundings
- traditional tennis scoreboard feel
- restrained cream / white UI details
- pixel-art players
- sunny outdoor championship atmosphere

It should feel nostalgic but polished.

Think:

**classic grass-court tennis game rebuilt as a modern hackathon demo.**

---

# 3. Camera and court

Use a fixed tennis-game camera from behind Player 1.

Something approximately like:

```text
             PLAYER 2

        ┌─────────────┐
       /               \
      /                 \
     |                   |
     |-------------------|  NET
     |                   |
      \                 /
       \_______________/

             PLAYER 1
```

The court should use perspective / trapezoidal geometry so the far baseline appears narrower than the near baseline.

This does NOT need real 3D.

Fake perspective using 2D coordinates.

The court should be generated programmatically using Phaser Graphics rather than using an image.

Draw:

- grass background
- outer court
- singles sidelines
- baselines
- service lines
- centre service line
- net
- subtle court wear / mowing bands if easy

Keep everything crisp and attractive.

---

# 4. Visual direction

Use an 8-bit / 16-bit inspired style.

Important:

Do NOT make everything extremely low resolution just for authenticity.

I want:

- pixel-art flavour
- sharp readable UI
- smooth gameplay
- modern effects where useful

Use pixel-art player sprites once assets are available.

Until then use attractive placeholder player/racket graphics.

Do not block development waiting for artwork.

Assets should live under something like:

```text
public/assets/
    players/
    rackets/
    balls/
    ui/
    audio/
```

The game must continue to work if custom art has not yet been supplied.

---

# 5. Core architecture

This part is extremely important.

The game will initially use keyboard controls.

Later, keyboard input will be replaced or supplemented by events generated from ESP32-S3 controllers.

Therefore input MUST be separated from gameplay.

Create something conceptually similar to:

```ts
type PlayerId = 1 | 2;

type ShotType = "forehand" | "backhand" | "serve";

interface GameAction {
  player: PlayerId;
  type: ShotType;
  power: number;
  direction: number;
  timestamp: number;
}
```

Where:

```text
power
0.0 → 1.0

direction
-1.0 → hard left
 0.0 → centre
+1.0 → hard right
```

Exact naming may be improved if appropriate.

The important idea is:

```text
Keyboard
     ↓
KeyboardInputAdapter
     ↓
GameAction
     ↓
TennisGame
```

Later we will add:

```text
ESP32
     ↓
WebSocketInputAdapter
     ↓
GameAction
     ↓
TennisGame
```

**Game logic must never directly depend on keyboard keys.**

---

# 6. Future ESP32 integration

Do NOT implement networking yet.

But design for it.

Eventually ESP32 devices may send messages similar to:

```json
{
  "player": 1,
  "gesture": "forehand",
  "power": 0.82,
  "direction": -0.21
}
```

or:

```json
{
  "player": 2,
  "gesture": "backhand",
  "power": 0.67,
  "direction": 0.34
}
```

The ESP32 will eventually:

1. read accelerometer + gyroscope values;
2. perform TinyML gesture recognition locally;
3. identify gesture:
   - forehand
   - backhand
   - serve
4. calculate approximate swing power;
5. potentially estimate direction;
6. send the resulting event wirelessly.

The browser game should only need to translate that message into the existing GameAction format.

Keep this future integration extremely easy.

---

# 7. Keyboard controls

For the first prototype:

## Player 1

```text
F = forehand
B = backhand
S = serve

A / D = aim left / right if needed
```

## Player 2

Use:

```text
← = backhand / aim left
→ = forehand / aim right
↑ = serve
```

If this control arrangement proves awkward, structure the code so controls can easily be remapped.

Initially keyboard shots can use predefined power values.

For example:

```text
normal shot = 0.7 power
```

Later we can experiment with holding a key to charge power.

Do not implement charge mechanics unless requested.

---

# 8. Gameplay philosophy

This should be an **arcade tennis game**, not a tennis simulator.

Prioritize:

- quick rallies
- obvious player feedback
- forgiving hit windows
- satisfying ball movement
- easy controls
- spectators immediately understanding what happened

The player should feel:

> "I swung and I hit that ball."

Eventually this feeling will correspond to physically swinging an ESP32 controller.

---

# 9. Ball system

Do NOT initially use complicated realistic 3D physics.

Represent the tennis ball using logical values such as:

```text
courtX
courtY
height
velocityX
velocityY
verticalVelocity
```

or another simple model.

Render those values into screen coordinates.

The ball should visibly:

- travel toward the opposite player
- rise after being hit
- descend
- bounce
- cross the net
- travel faster for more powerful shots

Fake whatever physics is necessary to make it feel good.

Fun > realism.

We should eventually be able to change:

```text
power
direction
shot type
```

and clearly see those differences.

---

# 10. Shot timing

A player should only be allowed to hit when the ball is reasonably close.

Use a generous arcade-style hit window.

If the player swings too early or too late:

- optionally show "EARLY!" or "LATE!"
- or simply miss

Do not make this punishing initially.

The first version should favour long rallies.

---

# 11. Scoring

Eventually use normal tennis-like scoring:

```text
0
15
30
40
GAME
```

For the first working prototype, however, a simpler point score is acceptable:

```text
PLAYER 1      PLAYER 2

    3    -    2
```

Do not let scoring complexity delay gameplay.

Structure scoring so normal tennis scoring could be added later.

---

# 12. HUD

The visual HUD should include:

```text
PLAYER 1               PLAYER 2

   3          SCORE        2
```

When shots happen display temporary feedback such as:

```text
FOREHAND!
```

and later:

```text
FOREHAND
82% POWER
```

Potential feedback:

```text
FOREHAND!
BACKHAND!
ACE!
GREAT SHOT!
SMASH!
MATCH POINT
```

Don't overdo text.

The court should remain visually dominant.

---

# 13. Effects / "game juice"

Once core gameplay works, we want inexpensive effects with high visual impact.

Possible effects include:

- short ball trail
- small particle burst when racket contacts ball
- tiny screen shake on powerful hits
- shadow below ball
- impact flash
- racket recoil
- subtle player animation
- ball squash on hard impact
- grass particles on bounce
- floating shot labels
- slight slow-motion on match point
- crowd reaction
- satisfying racket-hit audio
- bounce audio

Do not implement these before the basic game works.

---

# 14. Audio

Audio will come later.

Plan asset locations for:

```text
racket hit
ball bounce
net hit
crowd reaction
point won
match won
```

The game must work without audio files.

---

# 15. Responsive behaviour

Primary demo target:

**Laptop browser projected onto a larger screen.**

Prioritize approximately:

```text
16:9
1280×720
1920×1080
```

But use Phaser scaling so it remains usable on other screens.

The game should maintain its intended aspect ratio rather than stretching badly.

---

# 16. Development milestones

Follow these milestones exactly unless I tell you otherwise.

---

## MILESTONE 1 — Project skeleton + court

Build:

- npm project
- TypeScript
- Phaser
- esbuild
- index.html
- minimal CSS
- Phaser game config
- one GameScene
- Wimbledon-inspired grass court drawn programmatically
- net
- placeholder Player 1
- placeholder Player 2
- placeholder tennis ball
- HUD placeholders

No gameplay yet.

Goal:

When I run the project, I see a beautiful grass tennis court immediately.

STOP after completing this milestone.

---

## MILESTONE 2 — Ball rally prototype

Add:

- ball travelling Player 1 → Player 2
- ball travelling Player 2 → Player 1
- fake height/parabolic trajectory
- ball shadow
- bounce
- net visual interaction if useful

Initially the game may automatically return the ball.

Goal:

Make ball movement look convincing and fun.

STOP.

---

## MILESTONE 3 — Input abstraction

Create the core input architecture.

Implement:

```text
GameAction
InputAdapter
KeyboardInputAdapter
```

Keyboard events should generate generic GameActions.

Do NOT couple keyboard handling directly to ball logic.

Print or visually display generated actions so we can verify:

```text
P1 FOREHAND
P1 BACKHAND
P1 SERVE

P2 FOREHAND
P2 BACKHAND
P2 SERVE
```

STOP.

---

## MILESTONE 4 — Player-controlled rallies

Connect GameActions to gameplay.

Players should now need to press the correct key at approximately the right time to return the ball.

Implement:

- hit window
- successful return
- missed shot
- change of ball direction
- rally restart

Make hit timing forgiving.

Goal:

Two people should now be able to play an actual rally using one keyboard.

STOP.

---

## MILESTONE 5 — Direction + power

Use:

```text
power
direction
```

from GameAction.

Make them influence ball movement.

Temporary keyboard inputs can generate different test values.

For example:

```text
weak shot
normal shot
hard shot

left
centre
right
```

Do not create complicated controls.

Goal:

Prove that physical ESP32 swing characteristics will later visibly affect gameplay.

STOP.

---

## MILESTONE 6 — Scoring

Implement:

- point won
- Player 1 score
- Player 2 score
- serve/reset
- simple win condition

Start with simple integer scoring.

Goal:

A complete playable match now exists.

STOP.

---

## MILESTONE 7 — Arcade polish

Only after everything above is stable.

Add high-impact polish:

- ball trails
- impact particles
- bounce particles
- screen shake
- shot labels
- power display
- better scoreboard
- transitions
- subtle animations

Keep the grass-court / retro championship aesthetic.

STOP.

---

## MILESTONE 8 — Custom pixel-art assets

Replace placeholders using files I provide.

Do not redesign gameplay.

Support replacing:

- Player 1
- Player 2
- rackets
- ball
- scoreboard decorations
- trophy / winner graphic

Use texture atlases or sprite sheets only if they genuinely simplify things.

For a hackathon, individual PNGs are acceptable.

STOP.

---

## MILESTONE 9 — ESP32 WebSocket integration

DO NOT IMPLEMENT THIS UNTIL I REQUEST IT.

Eventually create:

```text
WebSocketInputAdapter
```

which converts network messages into the same GameAction type already used by the keyboard controller.

Keyboard controls should remain available as a debugging fallback.

Expected flow:

```text
ESP32 IMU
   ↓
TinyML
   ↓
gesture + power + direction
   ↓
Wi-Fi
   ↓
WebSocket
   ↓
WebSocketInputAdapter
   ↓
GameAction
   ↓
existing game
```

No gameplay code should need to know an ESP32 exists.

---

# 17. Code quality

This is a hackathon project.

Optimize for:

- readability
- speed of iteration
- clear responsibilities
- low dependency count
- reliable demo

Do NOT over-engineer.

Avoid:

- dependency injection frameworks
- elaborate state management
- unnecessary design patterns
- premature abstractions
- giant class hierarchies

A sensible structure might be approximately:

```text
src/
    main.ts

    game/
        GameScene.ts
        Ball.ts
        Court.ts
        Player.ts
        Score.ts

    input/
        GameAction.ts
        InputAdapter.ts
        KeyboardInputAdapter.ts

    config/
        gameConfig.ts

public/
    assets/
```

Change this if there is a clearly simpler structure.

---

# 18. Important hackathon constraint

At every stage:

**A working ugly game is better than a beautiful broken architecture.**

Never break a working milestone while trying to anticipate a later feature.

Keep keyboard input working even after future ESP32 support is introduced.

Build the smallest working version first.

---

# Start now

Implement **MILESTONE 1 only**.

Do not implement ball physics, keyboard controls, WebSockets, TinyML integration or scoring yet.

When Milestone 1 is complete:

1. explain what you built;
2. list the project structure;
3. give me the command to run it;
4. mention any assumptions;
5. STOP.
