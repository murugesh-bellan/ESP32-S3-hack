import Phaser from "phaser";

import { createUiButton } from "./UiButton";

export function addMenuExit(scene: Phaser.Scene): void {
  const exitToMenu = (): void => {
    scene.cameras.main.fadeOut(150, 7, 31, 24);
    scene.time.delayedCall(160, () => scene.scene.start("MenuScene"));
  };

  createUiButton(scene, 1172, 126, 170, 42, "MENU  [ESC]", exitToMenu);

  const keyboard = scene.input.keyboard;
  keyboard?.on("keydown-ESC", exitToMenu);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    keyboard?.off("keydown-ESC", exitToMenu);
  });
}
