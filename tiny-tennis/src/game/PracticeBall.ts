import Phaser from "phaser";

import type { GameAction, ShotType } from "../input/GameAction";

const FAR_Y = 318;
const NEAR_Y = 660;
const FAR_LEFT = 310;
const FAR_RIGHT = 970;
const NEAR_LEFT = 120;
const NEAR_RIGHT = 1160;
// Widened from 0.73-0.965 (23.5% of flight): the gesture controller pipeline
// (capture window + classify + relay round-trip) adds several hundred ms of
// inherent latency versus a keyboard press, so a narrow late-flight-only
// window made a correctly-classified swing miss anyway just from timing.
// A swing landing before the visual ground bounce just reads as a volley,
// same as in real tennis, so there's no need to keep this pinned above
// INBOUND_BOUNCE_PROGRESS (0.68).
const HIT_WINDOW_START = 0.4;
const HIT_WINDOW_END = 0.99;
const MISS_FLIGHT_MS = 540;
const INBOUND_BOUNCE_PROGRESS = 0.68;

type PracticeBallState =
  | "awaiting-serve"
  | "outbound"
  | "inbound"
  | "miss-flight"
  | "missed"
  | "stopped";

export type PracticeOutcome =
  | "served"
  | "hit"
  | "awkward-hit"
  | "early"
  | "wait"
  | "late"
  | "wrong-player"
  | "serve-required";

export interface PracticeHitResult {
  outcome: PracticeOutcome;
  recommendedShot?: Exclude<ShotType, "serve">;
}

interface PracticeBallCallbacks {
  onIncoming: (targetCourtX: number) => void;
  onMiss: () => void;
  onBounce: () => void;
}

export class PracticeBall {
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly sprite: Phaser.GameObjects.Container;
  private readonly trail: Phaser.GameObjects.Graphics;
  private readonly trailPoints: Phaser.Math.Vector2[] = [];
  private state: PracticeBallState = "awaiting-serve";
  private elapsedMs = 0;
  private durationMs = 1_000;
  private missElapsedMs = 0;
  private missBounceShown = false;
  private lateFrameShown = false;
  private missDeflection = 0;
  private fromX = 0;
  private toX = 0;
  private power = 0.7;
  private targetIndex = -1;
  private landingMarker?: Phaser.GameObjects.Ellipse;

  private readonly returnTargets = [-0.4, 0.38, -0.18, 0.44, 0.22, -0.46, 0.08] as const;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly callbacks: PracticeBallCallbacks,
  ) {
    this.trail = scene.add.graphics().setDepth(45);
    this.shadow = scene.add.ellipse(0, 0, 22, 8, 0x061a12, 0.4).setDepth(30);
    const ball = scene.add.circle(0, 0, 8, 0xdfff3f);
    const highlight = scene.add.circle(-2, -2, 2, 0xf6ffb5, 1);
    this.sprite = scene.add.container(0, 0, [ball, highlight]).setDepth(50);
    this.reset();
  }

  public update(deltaMs: number): void {
    if (this.state === "miss-flight") {
      const previousMissProgress = this.missProgress();
      this.missElapsedMs += deltaMs;
      const missProgress = this.missProgress();
      this.renderMiss(missProgress);

      if (!this.missBounceShown && previousMissProgress < 0.5 && missProgress >= 0.5) {
        this.missBounceShown = true;
        this.showBounce(0xf09a5a);
        this.callbacks.onBounce();
      }

      if (missProgress >= 1) {
        this.state = "missed";
        this.callbacks.onMiss();
      }
      return;
    }

    if (this.state !== "outbound" && this.state !== "inbound") {
      return;
    }

    const previousProgress = this.progress();
    this.elapsedMs += deltaMs;
    const progress = this.progress();
    this.renderAt(progress);

    if (this.state === "inbound" && previousProgress < INBOUND_BOUNCE_PROGRESS && progress >= INBOUND_BOUNCE_PROGRESS) {
      this.showBounce();
      this.callbacks.onBounce();
      this.destroyLandingMarker();
    }

    if (progress < 1) {
      return;
    }

    if (this.state === "outbound") {
      this.beginWallReturn();
    } else {
      this.beginMissFlight();
    }
  }

  public attemptAction(action: GameAction, playerCourtX: number): PracticeHitResult {
    if (action.player !== 1) {
      return { outcome: "wrong-player" };
    }

    if (this.state === "awaiting-serve") {
      if (action.type !== "serve") {
        return { outcome: "serve-required" };
      }

      this.showContact(action);
      this.beginOutbound(action);
      return { outcome: "served" };
    }

    if (this.state === "outbound") {
      return { outcome: "wait" };
    }

    if (this.state === "miss-flight") {
      if (action.type !== "serve") {
        this.showFrameClip(action);
      }
      return { outcome: "late" };
    }

    if (this.state === "missed" || this.state === "stopped") {
      return { outcome: "late" };
    }

    const recommendedShot = this.recommendedShot(playerCourtX);
    if (action.type === "serve") {
      return { outcome: "wait", recommendedShot };
    }

    if (this.progress() < HIT_WINDOW_START) {
      return { outcome: "early", recommendedShot };
    }

    if (this.progress() > HIT_WINDOW_END) {
      this.beginMissFlight();
      this.showFrameClip(action);
      return { outcome: "late", recommendedShot };
    }

    const isNaturalSide = action.type === recommendedShot;
    const returnedAction = isNaturalSide
      ? action
      : {
          ...action,
          power: action.power * 0.72,
          direction: action.direction * 0.65,
        };

    this.showContact(action);
    this.beginOutbound(returnedAction);
    return {
      outcome: isNaturalSide ? "hit" : "awkward-hit",
      recommendedShot,
    };
  }

  public reset(): void {
    this.state = "awaiting-serve";
    this.elapsedMs = 0;
    this.missElapsedMs = 0;
    this.missBounceShown = false;
    this.lateFrameShown = false;
    this.missDeflection = 0;
    this.fromX = 0;
    this.toX = 0;
    this.trailPoints.length = 0;
    this.trail.clear();
    this.destroyLandingMarker();
    this.renderAt(0);
  }

  public stop(): void {
    this.state = "stopped";
    this.trailPoints.length = 0;
    this.trail.clear();
    this.destroyLandingMarker();
  }

  private beginOutbound(action: GameAction): void {
    this.state = "outbound";
    this.elapsedMs = 0;
    this.missElapsedMs = 0;
    this.missBounceShown = false;
    this.lateFrameShown = false;
    this.missDeflection = 0;
    this.fromX = this.toX;
    this.power = Phaser.Math.Clamp(action.power, 0, 1);
    this.toX = Phaser.Math.Clamp(action.direction * 0.72, -0.8, 0.8);
    // Slowed down (was 1_280-720): the gesture pipeline's inherent latency
    // needs more real time to land within the hit window than a keyboard
    // press does.
    this.durationMs = Phaser.Math.Linear(1_700, 1_100, this.power);
    this.trailPoints.length = 0;
    this.trail.clear();
    this.renderAt(0);
  }

  private beginWallReturn(): void {
    this.showWallImpact();
    this.state = "inbound";
    this.elapsedMs = 0;
    this.fromX = this.toX;
    this.targetIndex = (this.targetIndex + 1) % this.returnTargets.length;
    this.toX = this.returnTargets[this.targetIndex];
    // Slowed down (was 1_500-1_180) for the same reason as the outbound leg
    // above - this is the return flight the player actually has to react to.
    this.durationMs = Phaser.Math.Linear(2_000, 1_600, this.power);
    this.callbacks.onIncoming(this.toX);
    this.trailPoints.length = 0;
    this.trail.clear();
    this.showLandingMarker();
    this.renderAt(0);
  }

  private beginMissFlight(): void {
    if (this.state === "miss-flight" || this.state === "missed") {
      return;
    }

    this.state = "miss-flight";
    this.missElapsedMs = 0;
    this.missBounceShown = false;
    this.destroyLandingMarker();
  }

  private recommendedShot(playerCourtX: number): Exclude<ShotType, "serve"> {
    return this.toX - playerCourtX >= 0 ? "forehand" : "backhand";
  }

  private progress(): number {
    return Phaser.Math.Clamp(this.elapsedMs / this.durationMs, 0, 1);
  }

  private missProgress(): number {
    return Phaser.Math.Clamp(this.missElapsedMs / MISS_FLIGHT_MS, 0, 1);
  }

  private renderAt(progress: number): void {
    const outbound = this.state === "outbound" || this.state === "awaiting-serve";
    const fromDepth = outbound ? 0.89 : 0.08;
    const toDepth = outbound ? 0.08 : 0.89;
    const courtDepth = Phaser.Math.Linear(fromDepth, toDepth, progress);
    const courtX = Phaser.Math.Linear(this.fromX, this.toX, progress);
    const ground = this.projectToScreen(courtX, courtDepth);
    const height = outbound ? this.outboundHeight(progress) : this.inboundHeight(progress);
    const perspective = Phaser.Math.Linear(0.58, 1, courtDepth);

    this.shadow.setPosition(ground.x, ground.y + 2);
    this.shadow.setScale(perspective * Phaser.Math.Linear(0.58, 1, 1 - Math.min(height / 120, 1)), perspective);
    this.shadow.setAlpha(Phaser.Math.Linear(0.16, 0.4, 1 - Math.min(height / 120, 1)));

    this.sprite.setPosition(ground.x, ground.y - height * perspective);
    this.sprite.setScale(perspective);

    if ((this.state === "outbound" || this.state === "inbound") && progress > 0) {
      this.trailPoints.push(new Phaser.Math.Vector2(this.sprite.x, this.sprite.y));
      if (this.trailPoints.length > 12) {
        this.trailPoints.shift();
      }
      this.drawTrail(perspective);
    }
  }

  private renderMiss(progress: number): void {
    const courtDepth = Phaser.Math.Linear(0.89, 1.13, progress);
    const driftDirection = this.toX >= 0 ? 1 : -1;
    const courtX = this.toX + (driftDirection * 0.05 + this.missDeflection) * progress;
    const ground = this.projectToScreen(courtX, courtDepth);
    const height = progress <= 0.5
      ? 28 * (1 - progress / 0.5)
      : 10 * Math.sin(Math.PI * ((progress - 0.5) / 0.5));
    const perspective = Phaser.Math.Clamp(Phaser.Math.Linear(0.58, 1, courtDepth), 0.58, 1.14);

    this.shadow.setPosition(ground.x, ground.y + 2);
    this.shadow.setScale(perspective);
    this.shadow.setAlpha(0.42);
    this.sprite.setPosition(ground.x, ground.y - Math.max(0, height) * perspective);
    this.sprite.setScale(perspective);

    this.trailPoints.push(new Phaser.Math.Vector2(this.sprite.x, this.sprite.y));
    if (this.trailPoints.length > 12) {
      this.trailPoints.shift();
    }
    this.drawTrail(perspective);
  }

  private drawTrail(perspective: number): void {
    this.trail.clear();
    this.trailPoints.forEach((point, index) => {
      const age = (index + 1) / this.trailPoints.length;
      const intensity = Phaser.Math.Linear(0.25, 0.47, this.power);
      this.trail.fillStyle(0xdfff3f, age * intensity);
      this.trail.fillCircle(point.x, point.y, perspective * age * Phaser.Math.Linear(4.5, 7.5, this.power));
    });
  }

  private showBounce(color = 0xdfff3f): void {
    const ring = this.scene.add
      .ellipse(this.shadow.x, this.shadow.y, 18, 7, color, 0.08)
      .setStrokeStyle(3, color, 0.82)
      .setDepth(55);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 2.5,
      scaleY: 1.7,
      alpha: 0,
      duration: 260,
      onComplete: () => ring.destroy(),
    });

    for (let index = 0; index < 6; index += 1) {
      const blade = this.scene.add.circle(this.shadow.x, this.shadow.y, 2, color, 0.9).setDepth(56);
      this.scene.tweens.add({
        targets: blade,
        x: blade.x + (index - 2.5) * 10,
        y: blade.y - 7 - (index % 2) * 6,
        alpha: 0,
        duration: 240 + index * 15,
        onComplete: () => blade.destroy(),
      });
    }
  }

  private outboundHeight(progress: number): number {
    const endpointHeight = Phaser.Math.Linear(28, 108, progress);
    const arcHeight = Phaser.Math.Linear(118, 82, this.power);

    return endpointHeight + 4 * arcHeight * progress * (1 - progress);
  }

  private inboundHeight(progress: number): number {
    const bounceProgress = INBOUND_BOUNCE_PROGRESS;
    if (progress <= bounceProgress) {
      const flightProgress = progress / bounceProgress;
      return 108 * (1 - flightProgress) + 4 * 92 * flightProgress * (1 - flightProgress);
    }

    const reboundProgress = (progress - bounceProgress) / (1 - bounceProgress);
    return 28 * reboundProgress + 4 * 42 * reboundProgress * (1 - reboundProgress);
  }

  private projectToScreen(courtX: number, courtDepth: number): Phaser.Math.Vector2 {
    const left = Phaser.Math.Linear(FAR_LEFT, NEAR_LEFT, courtDepth);
    const right = Phaser.Math.Linear(FAR_RIGHT, NEAR_RIGHT, courtDepth);

    return new Phaser.Math.Vector2(
      640 + courtX * (right - left) * 0.42,
      Phaser.Math.Linear(FAR_Y, NEAR_Y, courtDepth),
    );
  }

  private showContact(action: GameAction): void {
    const hardShot = action.power >= 0.9;
    const accent = hardShot ? 0xffd45c : 0xf6ffb5;
    const ring = this.scene.add
      .circle(this.sprite.x, this.sprite.y, 11, accent, 0.12)
      .setStrokeStyle(hardShot ? 6 : 4, accent, 1)
      .setDepth(80);
    const label = this.scene.add.text(this.sprite.x, this.sprite.y - 20, `${action.type.toUpperCase()}  ${Math.round(action.power * 100)}%`, {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: hardShot ? "21px" : "17px",
      fontStyle: "bold",
      color: hardShot ? "#ffd45c" : "#f6ffb5",
      stroke: "#173722",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(81);

    for (let index = 0; index < (hardShot ? 12 : 7); index += 1) {
      const angle = (Math.PI * 2 * index) / (hardShot ? 12 : 7);
      const spark = this.scene.add.circle(this.sprite.x, this.sprite.y, hardShot ? 3 : 2, accent, 0.95).setDepth(80);
      this.scene.tweens.add({
        targets: spark,
        x: spark.x + Math.cos(angle) * (hardShot ? 48 : 30),
        y: spark.y + Math.sin(angle) * (hardShot ? 34 : 23),
        scale: 0.2,
        alpha: 0,
        duration: hardShot ? 300 : 230,
        onComplete: () => spark.destroy(),
      });
    }

    this.scene.tweens.add({
      targets: ring,
      scale: 2.2,
      alpha: 0,
      duration: 220,
      onComplete: () => ring.destroy(),
    });
    this.scene.tweens.add({
      targets: label,
      y: label.y - 20,
      alpha: 0,
      duration: 340,
      onComplete: () => label.destroy(),
    });
  }

  private showWallImpact(): void {
    const flash = this.scene.add.rectangle(this.sprite.x, 281, 84, 8, 0xf6ffb5, 0.85).setDepth(72);
    const label = this.scene.add.text(this.sprite.x, this.sprite.y - 18, "WALL!", {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: "17px",
      fontStyle: "bold",
      color: "#f6ffb5",
      stroke: "#173722",
      strokeThickness: 4,
    }).setOrigin(0.5).setDepth(81);
    this.scene.tweens.add({
      targets: [flash, label],
      alpha: 0,
      scaleX: 1.5,
      duration: 260,
      onComplete: () => {
        flash.destroy();
        label.destroy();
      },
    });
  }

  private showFrameClip(action: GameAction): void {
    if (this.lateFrameShown) {
      return;
    }

    this.lateFrameShown = true;
    this.missDeflection = action.type === "forehand" ? 0.13 : -0.13;
    const ring = this.scene.add.circle(this.sprite.x, this.sprite.y, 9, 0xf09a5a, 0.12)
      .setStrokeStyle(4, 0xf09a5a, 1)
      .setDepth(82);
    const label = this.scene.add.text(this.sprite.x, this.sprite.y - 24, "FRAME!", {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: "18px",
      fontStyle: "bold",
      color: "#ffd0a8",
      stroke: "#5a2018",
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(83);
    this.scene.cameras.main.shake(55, 0.0018);
    this.scene.tweens.add({
      targets: [ring, label],
      y: `-=18`,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        ring.destroy();
        label.destroy();
      },
    });
  }

  private showLandingMarker(): void {
    this.destroyLandingMarker();
    const bounceDepth = Phaser.Math.Linear(0.08, 0.89, INBOUND_BOUNCE_PROGRESS);
    const point = this.projectToScreen(this.toX, bounceDepth);
    this.landingMarker = this.scene.add.ellipse(point.x, point.y + 2, 36, 13, 0xdfff3f, 0.08)
      .setStrokeStyle(2, 0xdfff3f, 0.62)
      .setDepth(32);
    this.scene.tweens.add({
      targets: this.landingMarker,
      scaleX: 1.35,
      scaleY: 1.35,
      alpha: 0.2,
      duration: 320,
      yoyo: true,
      repeat: -1,
    });
  }

  private destroyLandingMarker(): void {
    this.landingMarker?.destroy();
    this.landingMarker = undefined;
  }
}
