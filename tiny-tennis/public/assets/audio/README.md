# Tiny Tennis audio assets

## Integrated audio

The game currently loads these files from the project's top-level `assets/` directory:

- `game_intro.mp3` — looping menu/title music; stops when a game mode starts
- `practice.mp3` — looping Practice music; stops when Practice exits
- `ball-hit.mp3` — every successful serve or racket return, including computer shots
- `bounce.mp3` — every grass-court bounce in Practice and match modes
- `out.mp3` — a missed/out call when the visible miss flight ends the rally
- `won.mp3` — match victory sting when Player 1, Computer or Player 2 wins

The supplied `bounce.mov` contains an MP3 audio track. It is preserved as the source file; `bounce.mp3` is the browser-ready extracted version used by the game.

Browsers can delay music until the player's first click or key press because of autoplay restrictions.

## Score voice recordings

The game now uses Love/15/30/40, deuce, advantage and game scoring. The exact **22-file** voice script and filenames are in [`SCORE_RECORDINGS.md`](./SCORE_RECORDINGS.md). Browser speech synthesis remains active until those recordings are supplied.

## Optional future sounds

These filenames remain available for a later expanded audio pass:

- `crowd-ambience-loop.mp3` — restrained outdoor crowd bed with no announcements
- `crowd-cheer.mp3` — short reaction for a won point or long rally
- `racket-hit-soft.mp3` — light racket contact
- `racket-hit-normal.mp3` — standard rally contact
- `racket-hit-hard.mp3` — strong or smash contact
- `ball-bounce-grass.mp3` — short grass-court bounce
- `wall-hit.mp3` — firm practice-wall impact
- `point-won.mp3` — short positive score sting
- `match-won.mp3` — 2–4 second victory sting
- `miss.mp3` — subtle missed-shot cue

Preferred delivery: clean MP3 or OGG files, normalized to similar perceived volume. Looping files should have seamless edit points. Avoid spoken score clips because the game uses browser speech synthesis for dynamic score announcements.
