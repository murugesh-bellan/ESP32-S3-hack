# Tiny Tennis score recordings

Record these **22 clips** as clean, dry MP3 or OGG files with a consistent umpire voice, pace and volume.

Place the finished MP3 files in `assets/score/`. Each filename matches the stable callout key already emitted by the scoring system.

For ordinary score calls, the first value is always **Player 1** and the second is always the opponent (**Computer** in Level 2 or **Player 2** in Level 3). Those 16 neutral clips, including deuce, are shared by both modes.

## Normal score calls — 15 files

| Filename | Exact spoken line |
|---|---|
| `score-love-all.mp3` | “Love all.” |
| `score-15-love.mp3` | “Fifteen, love.” |
| `score-love-15.mp3` | “Love, fifteen.” |
| `score-15-all.mp3` | “Fifteen all.” |
| `score-30-love.mp3` | “Thirty, love.” |
| `score-love-30.mp3` | “Love, thirty.” |
| `score-30-15.mp3` | “Thirty, fifteen.” |
| `score-15-30.mp3` | “Fifteen, thirty.” |
| `score-30-all.mp3` | “Thirty all.” |
| `score-40-love.mp3` | “Forty, love.” |
| `score-love-40.mp3` | “Love, forty.” |
| `score-40-15.mp3` | “Forty, fifteen.” |
| `score-15-40.mp3` | “Fifteen, forty.” |
| `score-40-30.mp3` | “Forty, thirty.” |
| `score-30-40.mp3` | “Thirty, forty.” |

## Deuce — 1 file

| Filename | Exact spoken line |
|---|---|
| `score-deuce.mp3` | “Deuce.” |

## Advantage — 3 files

| Filename | Exact spoken line |
|---|---|
| `advantage-player-one.mp3` | “Advantage, Player one.” |
| `advantage-computer.mp3` | “Advantage, Computer.” |
| `advantage-player-two.mp3` | “Advantage, Player two.” |

## Game — 3 files

| Filename | Exact spoken line |
|---|---|
| `game-player-one.mp3` | “Game, Player one.” |
| `game-computer.mp3` | “Game, Computer.” |
| `game-player-two.mp3` | “Game, Player two.” |

## Recording notes

- Leave roughly 50–100 ms of clean space at each end.
- Do not add music, crowd noise, reverb or normalization that clips peaks.
- Keep “fifteen,” “thirty,” “forty,” “deuce,” “advantage” and “game” pronunciation consistent.
- Browser speech synthesis remains the fallback until these files are supplied and integrated.
