import Phaser from "phaser";

import {
  AUDIO_KEYS,
  playBallHit,
  playBounce,
  playOut,
  preloadPracticeAudio,
  startSceneMusic,
} from "../audio/GameAudio";
import type { GameAction } from "../input/GameAction";
import type { InputAdapter } from "../input/InputAdapter";
import { KeyboardInputAdapter } from "../input/KeyboardInputAdapter";
import { addMenuExit } from "../ui/addMenuExit";
import { createUiButton } from "../ui/UiButton";
import { Player } from "./Player";
import { PracticeBall, type PracticeHitResult } from "./PracticeBall";

const FONT_STACK = '"Courier New", Courier, monospace';
const INTERCEPT_OFFSET = 0.1;

export class PracticeScene extends Phaser.Scene {
  private player!: Player;
  private ball!: PracticeBall;
  private inputAdapter!: InputAdapter;
  private resetTimer?: Phaser.Time.TimerEvent;
  private hits = 0;
  private misses = 0;
  private streak = 0;
  private bestStreak = 0;
  private hitsText!: Phaser.GameObjects.Text;
  private missesText!: Phaser.GameObjects.Text;
  private streakText!: Phaser.GameObjects.Text;
  private bestStreakText!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private detailText!: Phaser.GameObjects.Text;

  public constructor() {
    super("PracticeScene");
  }

  public preload(): void {
    preloadPracticeAudio(this);
  }

  public create(): void {
    startSceneMusic(this, AUDIO_KEYS.practiceMusic, 0.34);
    this.hits = 0;
    this.misses = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.resetTimer = undefined;
    this.cameras.main.fadeIn(220, 7, 31, 24);
    this.drawPracticeCourt();
    this.createHud();
    this.player = new Player(this, 640, 625, "near");
    this.ball = new PracticeBall(this, {
      onIncoming: (targetCourtX) => this.positionForReturn(targetCourtX),
      onMiss: () => this.handleMiss(),
      onBounce: () => playBounce(this),
    });
    this.startInput();
    addMenuExit(this);
    createUiButton(this, 968, 126, 170, 42, "RESET STATS", () => this.resetStats());
    this.setStatus("FREE PRACTICE", "PRESS S TO SERVE — THERE IS NO TIME LIMIT");
  }

  public update(_time: number, delta: number): void {
    this.player.update(delta);
    this.ball.update(delta);
  }

  private drawPracticeCourt(): void {
    const graphics = this.add.graphics();

    graphics.fillStyle(0x09291e, 1);
    graphics.fillRect(0, 0, 1280, 720);

    graphics.fillStyle(0x234938, 1);
    graphics.fillRect(150, 104, 980, 216);
    for (let y = 118; y < 310; y += 32) {
      for (let x = 168 + ((y / 32) % 2) * 18; x < 1120; x += 72) {
        graphics.lineStyle(2, 0x17392b, 0.7);
        graphics.strokeRect(x, y, 68, 27);
      }
    }

    graphics.fillStyle(0x2f7b45, 1);
    graphics.fillPoints([
      new Phaser.Math.Vector2(310, 318),
      new Phaser.Math.Vector2(970, 318),
      new Phaser.Math.Vector2(1160, 680),
      new Phaser.Math.Vector2(120, 680),
    ], true);

    for (let index = 0; index < 8; index += 1) {
      if (index % 2 === 0) {
        graphics.fillStyle(0x3a8650, 0.38);
        const topProgress = index / 8;
        const bottomProgress = (index + 1) / 8;
        const topY = Phaser.Math.Linear(318, 680, topProgress);
        const bottomY = Phaser.Math.Linear(318, 680, bottomProgress);
        const topLeft = Phaser.Math.Linear(310, 120, topProgress);
        const topRight = Phaser.Math.Linear(970, 1160, topProgress);
        const bottomLeft = Phaser.Math.Linear(310, 120, bottomProgress);
        const bottomRight = Phaser.Math.Linear(970, 1160, bottomProgress);
        graphics.fillPoints([
          new Phaser.Math.Vector2(topLeft, topY),
          new Phaser.Math.Vector2(topRight, topY),
          new Phaser.Math.Vector2(bottomRight, bottomY),
          new Phaser.Math.Vector2(bottomLeft, bottomY),
        ], true);
      }
    }

    graphics.lineStyle(4, 0xf3e9ca, 1);
    graphics.strokePoints([
      new Phaser.Math.Vector2(310, 318),
      new Phaser.Math.Vector2(970, 318),
      new Phaser.Math.Vector2(1160, 680),
      new Phaser.Math.Vector2(120, 680),
    ], true);
    graphics.lineBetween(235, 516, 1045, 516);
    graphics.lineBetween(640, 516, 640, 680);

    graphics.fillStyle(0xe9e1c3, 1);
    graphics.fillRect(150, 278, 980, 7);
    graphics.fillStyle(0x102d23, 0.75);
    graphics.fillRect(150, 285, 980, 11);

    this.drawWallTarget(420, 263, 0x7fc958);
    this.drawWallTarget(860, 263, 0xd9bd68);

    this.add.text(640, 235, "PRACTICE WALL", {
      fontFamily: FONT_STACK,
      fontSize: "25px",
      fontStyle: "bold",
      color: "#e9e1c3",
      stroke: "#17392b",
      strokeThickness: 5,
      letterSpacing: 3,
    }).setOrigin(0.5).setDepth(5);
  }

  private createHud(): void {
    this.add.rectangle(640, 52, 1280, 104, 0x071f18, 1).setDepth(100);
    this.add.rectangle(640, 102, 1280, 4, 0xd9bd68, 1).setDepth(101);

    this.hitsText = this.add.text(54, 27, "HITS  0", this.hudStyle()).setDepth(102);
    this.missesText = this.add.text(54, 59, "MISSES  0", this.hudStyle()).setDepth(102);
    this.streakText = this.add.text(1_030, 27, "STREAK  0", this.hudStyle()).setDepth(102);
    this.bestStreakText = this.add.text(1_030, 59, "BEST  0", {
      ...this.hudStyle(),
      fontSize: "15px",
      color: "#d9bd68",
    }).setDepth(102);
    this.add.text(640, 29, "FREE PLAY", {
      ...this.hudStyle(),
      fontSize: "29px",
      color: "#dfff3f",
    }).setOrigin(0.5, 0).setDepth(102);

    this.add.rectangle(640, 342, 620, 58, 0x071f18, 0.9)
      .setStrokeStyle(2, 0xd9bd68, 0.85)
      .setDepth(100);
    this.statusText = this.add.text(640, 323, "", {
      fontFamily: FONT_STACK,
      fontSize: "17px",
      fontStyle: "bold",
      color: "#f3e9ca",
    }).setOrigin(0.5, 0).setDepth(101);
    this.detailText = this.add.text(640, 348, "", {
      fontFamily: FONT_STACK,
      fontSize: "10px",
      fontStyle: "bold",
      color: "#b7c9ac",
      letterSpacing: 1,
    }).setOrigin(0.5, 0).setDepth(101);

    this.add.text(640, 706, "F FOREHAND • B BACKHAND • S SERVE • AIM A/D • SPACE SOFT • SHIFT HARD", {
      fontFamily: FONT_STACK,
      fontSize: "11px",
      fontStyle: "bold",
      color: "#b7c9ac",
    }).setOrigin(0.5, 1).setDepth(101);
  }

  private startInput(): void {
    this.inputAdapter = new KeyboardInputAdapter();
    this.inputAdapter.start((action) => this.handleAction(action));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.inputAdapter.stop());
  }

  private handleAction(action: GameAction): void {
    if (action.player === 1) {
      this.player.swing(action.type);
    }

    const result = this.ball.attemptAction(action, this.player.getCourtX());
    console.info("Practice GameAction", action, result);
    this.showResult(action, result);

    if (result.outcome === "served") {
      playBallHit(this);
      this.player.moveToCourtX(0);
    }

    if (result.outcome === "hit" || result.outcome === "awkward-hit") {
      playBallHit(this);
      this.hits += 1;
      this.streak += 1;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
      this.hitsText.setText(`HITS  ${this.hits}`);
      this.updateStreakHud();
      this.player.moveToCourtX(0);
      if (action.power >= 0.9) {
        this.cameras.main.shake(125, 0.0048);
      }
      if (this.streak > 0 && this.streak % 5 === 0) {
        this.setStatus(`${this.streak} HIT STREAK!`, "KEEP THE RHYTHM — AIM FOR THE WALL TARGETS");
      }
    }
  }

  private showResult(action: GameAction, result: PracticeHitResult): void {
    switch (result.outcome) {
      case "served":
        this.setStatus("SERVE!", this.shotDetail(action));
        break;
      case "hit":
        this.setStatus(`${action.type.toUpperCase()}!`, `CLEAN HIT  •  ${this.shotDetail(action)}`);
        break;
      case "awkward-hit":
        this.setStatus(
          `STRETCH ${action.type.toUpperCase()}!`,
          `RETURNED  •  ${result.recommendedShot?.toUpperCase()} WAS THE NATURAL SIDE`,
        );
        break;
      case "early":
        this.setStatus("EARLY!", "SWING WHEN THE BALL REACHES YOUR RACKET");
        break;
      case "wait":
        this.setStatus("WAIT!", "THE BALL IS MOVING TOWARD THE WALL");
        break;
      case "late":
        this.setStatus("LATE!", "PRESS S WHEN THE BALL RESETS");
        break;
      case "wrong-player":
        this.setStatus("PLAYER 1 PRACTICE", "USE F, B AND S — NOT THE ARROW KEYS");
        break;
      case "serve-required":
        this.setStatus("SERVE REQUIRED", "PRESS S");
        break;
    }
  }

  private handleMiss(): void {
    playOut(this);
    this.misses += 1;
    this.streak = 0;
    this.missesText.setText(`MISSES  ${this.misses}`);
    this.updateStreakHud();
    this.setStatus("MISS!", "RESETTING — PRESS S TO SERVE AGAIN");
    this.cameras.main.flash(110, 190, 72, 45, false);
    this.cameras.main.shake(70, 0.002);
    this.player.reactToMiss();

    this.resetTimer?.remove(false);
    this.resetTimer = this.time.delayedCall(650, () => {
      this.ball.reset();
      this.player.moveToCourtX(0);
      this.setStatus("PRESS S TO SERVE", "KEEP THE WALL RALLY GOING");
    });
  }

  private positionForReturn(targetCourtX: number): void {
    const stanceOffset = targetCourtX >= 0 ? -INTERCEPT_OFFSET : INTERCEPT_OFFSET;
    this.player.moveToCourtX(targetCourtX + stanceOffset);
    this.setStatus("BALL RETURNING", "CHOOSE FOREHAND OR BACKHAND AS IT REACHES YOU");
  }

  private resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.streak = 0;
    this.bestStreak = 0;
    this.hitsText.setText("HITS  0");
    this.missesText.setText("MISSES  0");
    this.updateStreakHud();
    this.setStatus("STATS RESET", "KEEP PLAYING — NO NEED TO RESTART");
  }

  private setStatus(title: string, detail: string): void {
    this.statusText.setText(title);
    this.detailText.setText(detail);
    this.statusText.setScale(0.96);
    this.tweens.add({
      targets: this.statusText,
      scale: 1,
      duration: 120,
      ease: "Back.easeOut",
    });
  }

  private updateStreakHud(): void {
    this.streakText.setText(`STREAK  ${this.streak}`);
    this.streakText.setColor(this.streak >= 5 ? "#dfff3f" : "#f3e9ca");
    this.bestStreakText.setText(`BEST  ${this.bestStreak}`);
    this.streakText.setScale(0.9);
    this.tweens.add({
      targets: this.streakText,
      scale: 1,
      duration: 150,
      ease: "Back.easeOut",
    });
  }

  private drawWallTarget(x: number, y: number, accent: number): void {
    const target = this.add.container(x, y).setDepth(4);
    const outer = this.add.circle(0, 0, 34, 0x17392b, 0.5).setStrokeStyle(3, accent, 0.78);
    const middle = this.add.circle(0, 0, 21, accent, 0.12).setStrokeStyle(2, accent, 0.86);
    const centre = this.add.circle(0, 0, 7, accent, 0.9);
    target.add([outer, middle, centre]);
    this.tweens.add({
      targets: centre,
      scale: 1.25,
      alpha: 0.58,
      duration: 720 + (x % 3) * 90,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private shotDetail(action: GameAction): string {
    const power = Math.round(action.power * 100);
    const direction = action.direction < 0 ? "LEFT" : action.direction > 0 ? "RIGHT" : "CENTRE";
    return `${power}% POWER  •  ${direction}`;
  }

  private hudStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return {
      fontFamily: FONT_STACK,
      fontSize: "19px",
      fontStyle: "bold",
      color: "#f3e9ca",
    };
  }
}
