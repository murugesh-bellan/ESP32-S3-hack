import Phaser from "phaser";

import { AUDIO_KEYS, preloadMenuAudio, startSceneMusic } from "../audio/GameAudio";
import { createUiButton } from "../ui/UiButton";

const FONT_STACK = '"Courier New", Courier, monospace';

export class MenuScene extends Phaser.Scene {
  public constructor() {
    super("MenuScene");
  }

  public preload(): void {
    preloadMenuAudio(this);
  }

  public create(): void {
    startSceneMusic(this, AUDIO_KEYS.menuMusic, 0.38);
    this.cameras.main.setBackgroundColor("#071f18");
    this.cameras.main.fadeIn(240, 7, 31, 24);
    this.drawBackground();

    const title = this.add.text(640, 118, "TINY TENNIS", {
      fontFamily: FONT_STACK,
      fontSize: "62px",
      fontStyle: "bold",
      color: "#f3e9ca",
      stroke: "#123f2e",
      strokeThickness: 10,
    }).setOrigin(0.5);
    this.tweens.add({
      targets: title,
      y: 113,
      scale: 1.015,
      duration: 1_350,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.add.text(640, 178, "REAL SWINGS.  TINY AI.  BIG RALLIES.", {
      fontFamily: FONT_STACK,
      fontSize: "17px",
      fontStyle: "bold",
      color: "#d9bd68",
      letterSpacing: 2,
    }).setOrigin(0.5);

    this.add.text(640, 246, "CHOOSE A MODE", {
      fontFamily: FONT_STACK,
      fontSize: "20px",
      fontStyle: "bold",
      color: "#b7c9ac",
      letterSpacing: 3,
    }).setOrigin(0.5);

    createUiButton(this, 640, 318, 430, 62, "LEVEL 1  —  PRACTICE WALL", () => {
      this.startMode("PracticeScene");
    });
    this.add.text(640, 357, "untimed free play • test strokes, aim and power", {
      fontFamily: FONT_STACK,
      fontSize: "13px",
      color: "#c6d3bd",
    }).setOrigin(0.5);

    createUiButton(this, 640, 432, 430, 62, "LEVEL 2  —  PLAY COMPUTER", () => {
      this.startMode("GameScene", { mode: "computer" });
    });
    this.add.text(640, 471, "first to five points • Player 1 controls the near court", {
      fontFamily: FONT_STACK,
      fontSize: "13px",
      color: "#c6d3bd",
    }).setOrigin(0.5);

    createUiButton(this, 640, 546, 430, 62, "LEVEL 3  —  TWO PLAYERS", () => {
      this.startMode("GameScene", { mode: "local" });
    });
    this.add.text(640, 585, "share one keyboard • first to five points", {
      fontFamily: FONT_STACK,
      fontSize: "13px",
      color: "#c6d3bd",
    }).setOrigin(0.5);

    this.add.text(640, 672, "SELECT WITH THE MOUSE", {
      fontFamily: FONT_STACK,
      fontSize: "12px",
      fontStyle: "bold",
      color: "#7fa38b",
      letterSpacing: 2,
    }).setOrigin(0.5);

    const menuBall = this.add.circle(1_090, 142, 8, 0xdfff3f, 1)
      .setStrokeStyle(2, 0xf6ffb5, 0.8);
    const menuShadow = this.add.ellipse(1_090, 194, 30, 8, 0x061a12, 0.38);
    this.tweens.add({
      targets: menuBall,
      y: 181,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: "Quad.easeIn",
    });
    this.tweens.add({
      targets: menuShadow,
      scaleX: 0.58,
      alpha: 0.18,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: "Quad.easeIn",
    });
  }

  private drawBackground(): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(0x0c3827, 1);
    graphics.fillRect(0, 0, 1280, 720);
    for (let x = 0; x < 1280; x += 80) {
      graphics.fillStyle(x % 160 === 0 ? 0x12442f : 0x0e3b29, 0.62);
      graphics.fillRect(x, 0, 80, 720);
    }

    graphics.fillStyle(0x2f7b45, 0.56);
    graphics.fillPoints([
      new Phaser.Math.Vector2(450, 224),
      new Phaser.Math.Vector2(830, 224),
      new Phaser.Math.Vector2(1060, 720),
      new Phaser.Math.Vector2(220, 720),
    ], true);

    graphics.lineStyle(4, 0xf3e9ca, 0.38);
    graphics.strokePoints([
      new Phaser.Math.Vector2(450, 224),
      new Phaser.Math.Vector2(830, 224),
      new Phaser.Math.Vector2(1060, 720),
      new Phaser.Math.Vector2(220, 720),
    ], true);
    graphics.lineBetween(330, 472, 950, 472);
  }

  private startMode(sceneKey: string, data?: object): void {
    this.cameras.main.fadeOut(160, 7, 31, 24);
    this.time.delayedCall(170, () => this.scene.start(sceneKey, data));
  }
}
