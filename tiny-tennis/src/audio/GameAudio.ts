import Phaser from "phaser";

const AUDIO_PATH = "assets";

export const AUDIO_KEYS = {
  ballHit: "audio-ball-hit",
  bounce: "audio-bounce",
  out: "audio-out",
  won: "audio-won",
  menuMusic: "audio-menu-music",
  practiceMusic: "audio-practice-music",
} as const;

function loadOnce(scene: Phaser.Scene, key: string, filename: string): void {
  if (!scene.cache.audio.exists(key)) {
    scene.load.audio(key, `${AUDIO_PATH}/${filename}`);
  }
}

export function preloadMenuAudio(scene: Phaser.Scene): void {
  loadOnce(scene, AUDIO_KEYS.menuMusic, "game_intro.mp3");
}

export function preloadPracticeAudio(scene: Phaser.Scene): void {
  loadOnce(scene, AUDIO_KEYS.practiceMusic, "practice.mp3");
  preloadCourtSounds(scene);
}

export function preloadCourtSounds(scene: Phaser.Scene): void {
  loadOnce(scene, AUDIO_KEYS.ballHit, "ball-hit.mp3");
  loadOnce(scene, AUDIO_KEYS.bounce, "bounce.mp3");
  loadOnce(scene, AUDIO_KEYS.out, "out.mp3");
  loadOnce(scene, AUDIO_KEYS.won, "won.mp3");
}

export function startSceneMusic(
  scene: Phaser.Scene,
  key: string,
  volume: number,
): Phaser.Sound.BaseSound {
  const music = scene.sound.add(key, { loop: true, volume });
  const start = (): void => {
    if (!music.isPlaying) {
      music.play();
    }
  };

  start();

  // Browsers may suspend audio until the first click or key press. Phaser emits
  // this event after that interaction, allowing the requested scene music to start.
  if (scene.sound.locked) {
    scene.sound.once(Phaser.Sound.Events.UNLOCKED, start);
  }

  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    scene.sound.off(Phaser.Sound.Events.UNLOCKED, start);
    music.stop();
    music.destroy();
  });

  return music;
}

export function playBallHit(scene: Phaser.Scene): void {
  scene.sound.play(AUDIO_KEYS.ballHit, { volume: 0.62 });
}

export function playBounce(scene: Phaser.Scene): void {
  scene.sound.play(AUDIO_KEYS.bounce, { volume: 0.48 });
}

export function playOut(scene: Phaser.Scene): void {
  scene.sound.play(AUDIO_KEYS.out, { volume: 0.62 });
}

export function playWon(scene: Phaser.Scene): void {
  scene.sound.play(AUDIO_KEYS.won, { volume: 0.78 });
}
