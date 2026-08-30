import Phaser from "phaser";

import type { GameAction, PlayerId, ShotType } from "../input/GameAction";
import { COURT } from "./Court";

// Widened from 0.8-0.97 (17% of flight) - see PracticeBall.ts for why: the
// gesture controller pipeline's inherent latency made a correctly-classified
// swing miss on timing alone, and hitting before the bounce just reads as a
// volley rather than being visually wrong.
const HIT_WINDOW_START = 0.4;
const HIT_WINDOW_END = 0.99;
const BOUNCE_PROGRESS = 0.72;
const CONTACT_HEIGHT = 28;
const SHOT_SIDE_THRESHOLD = 0.06;
const MISS_FLIGHT_MS = 460;

type RallyDirection = "near-to-far" | "far-to-near";
type BallState = "awaiting-serve" | "in-flight" | "miss-flight" | "missed" | "stopped";

export type HitOutcome =
  | "served"
  | "hit"
  | "awkward-hit"
  | "early"
  | "late"
  | "wrong-player"
  | "wrong-shot"
  | "serve-required";

export interface HitResult {
  outcome: HitOutcome;
  recommendedShot?: Exclude<ShotType, "serve">;
}

export class Ball {
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly sprite: Phaser.GameObjects.Container;
  private readonly trail: Phaser.GameObjects.Graphics;
  private readonly trailPoints: Phaser.Math.Vector2[] = [];
  private state: BallState = "awaiting-serve";
  private server: PlayerId = 1;
  private receiver: PlayerId = 2;
  private direction: RallyDirection = "near-to-far";
  private elapsedMs = 0;
  private missElapsedMs = 0;
  private missBounceShown = false;
  private lateFrameShown = false;
  private missDeflection = 0;
  private shotDurationMs = 1_420;
  private shotPower = 0.7;
  private arcHeight = 106;
  private reboundHeight = 34;
  private fromX = 0;
  private toX = 0;
  private targetIndex = -1;
  private landingMarker?: Phaser.GameObjects.Ellipse;

  private readonly rallyTargets = [0.52, -0.28, -0.56, 0.34, 0.62, -0.42, -0.24, 0.48] as const;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly onMiss: (missedPlayer: PlayerId) => void,
    private readonly onBounce: () => void,
  ) {
    this.trail = scene.add.graphics().setDepth(25);
    this.shadow = scene.add.ellipse(0, 0, 22, 8, 0x061a12, 0.38).setDepth(12);

    const ball = scene.add.circle(0, 0, 7, 0xdfff3f);
    const highlight = scene.add.circle(-2, -2, 2, 0xf6ffb5, 0.95);
    this.sprite = scene.add.container(0, 0, [ball, highlight]).setDepth(26);

    this.resetForServe(1);
  }

  public update(deltaMs: number): void {
    if (this.state === "miss-flight") {
      const previousMissProgress = this.missProgress();
      this.missElapsedMs += deltaMs;
      const missProgress = this.missProgress();
      this.renderMiss(missProgress);

      if (!this.missBounceShown && previousMissProgress < 0.52 && missProgress >= 0.52) {
        this.missBounceShown = true;
        this.showBounce(0xf09a5a);
        this.onBounce();
      }

      if (missProgress >= 1) {
        this.state = "missed";
        this.onMiss(this.receiver);
      }
      return;
    }

    if (this.state !== "in-flight") {
      return;
    }

    const previousProgress = this.progress();
    this.elapsedMs += deltaMs;
    const progress = this.progress();
    this.renderAt(progress);

    if (previousProgress < BOUNCE_PROGRESS && progress >= BOUNCE_PROGRESS) {
      this.showBounce();
      this.onBounce();
      this.destroyLandingMarker();
    }

    if (progress >= 1) {
      this.beginMissFlight();
    }
  }

  public attemptAction(action: GameAction, playerCourtX: number): HitResult {
    if (this.state === "awaiting-serve") {
      if (action.player !== this.server) {
        return { outcome: "wrong-player" };
      }

      if (action.type !== "serve") {
        return { outcome: "serve-required" };
      }

      this.showContact(action);
      this.startShot(action);
      return { outcome: "served" };
    }

    if (action.player !== this.receiver) {
      return { outcome: "wrong-player" };
    }

    const recommendedShot = this.recommendedShot(playerCourtX);

    if (this.state === "miss-flight") {
      if (action.type !== "serve") {
        this.showFrameClip(action);
      }
      return { outcome: "late", recommendedShot };
    }

    if (this.state === "missed" || this.state === "stopped") {
      return { outcome: "late", recommendedShot };
    }

    if (action.type === "serve") {
      return { outcome: "wrong-shot", recommendedShot };
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
    const returnedAction: GameAction = isNaturalSide
      ? action
      : {
          ...action,
          power: action.power * 0.72,
          direction: action.direction * 0.65,
        };

    this.showContact(action);
    this.startShot(returnedAction);
    return {
      outcome: isNaturalSide ? "hit" : "awkward-hit",
      recommendedShot,
    };
  }

  public resetForServe(server: PlayerId): void {
    this.state = "awaiting-serve";
    this.server = server;
    this.receiver = server === 1 ? 2 : 1;
    this.direction = server === 1 ? "near-to-far" : "far-to-near";
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

  public getReceiver(): PlayerId {
    return this.receiver;
  }

  public getTargetCourtX(): number {
    return this.toX;
  }

  public isReadyForReturn(player: PlayerId): boolean {
    return this.state === "in-flight"
      && this.receiver === player
      && this.progress() >= 0.86
      && this.progress() <= HIT_WINDOW_END;
  }

  public getRecommendedShot(playerCourtX: number): Exclude<ShotType, "serve"> {
    return this.recommendedShot(playerCourtX);
  }

  public stop(): void {
    this.state = "stopped";
    this.trailPoints.length = 0;
    this.trail.clear();
    this.destroyLandingMarker();
  }

  private startShot(action: GameAction): void {
    const power = Phaser.Math.Clamp(action.power, 0, 1);

    this.state = "in-flight";
    this.elapsedMs = 0;
    this.missElapsedMs = 0;
    this.missBounceShown = false;
    this.lateFrameShown = false;
    this.missDeflection = 0;
    this.direction = action.player === 1 ? "near-to-far" : "far-to-near";
    this.receiver = action.player === 1 ? 2 : 1;
    this.fromX = this.toX;
    this.targetIndex = (this.targetIndex + 1) % this.rallyTargets.length;

    const naturalPlacement = this.rallyTargets[this.targetIndex] * 0.54;
    const aimedPlacement = action.direction * 0.68;
    this.toX = Phaser.Math.Clamp(naturalPlacement + aimedPlacement, -0.82, 0.82);

    this.shotDurationMs = Phaser.Math.Linear(1_800, 980, power);
    this.shotPower = power;
    this.arcHeight = Phaser.Math.Linear(124, 88, power);
    this.reboundHeight = Phaser.Math.Linear(27, 47, power);
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
    const ballOffset = this.toX - playerCourtX;

    if (ballOffset > SHOT_SIDE_THRESHOLD) {
      return "forehand";
    }

    if (ballOffset < -SHOT_SIDE_THRESHOLD) {
      return "backhand";
    }

    return this.toX >= 0 ? "forehand" : "backhand";
  }

  private progress(): number {
    return Phaser.Math.Clamp(this.elapsedMs / this.shotDurationMs, 0, 1);
  }

  private missProgress(): number {
    return Phaser.Math.Clamp(this.missElapsedMs / MISS_FLIGHT_MS, 0, 1);
  }

  private showContact(action: GameAction): void {
    const hardShot = action.power >= 0.9;
    const accent = hardShot ? 0xffd45c : 0xf6ffb5;
    const ring = this.scene.add
      .circle(this.sprite.x, this.sprite.y, 11, accent, 0.12)
      .setStrokeStyle(hardShot ? 6 : 4, accent, 1)
      .setDepth(45);
    const label = this.scene.add
      .text(this.sprite.x, this.sprite.y - 20, `${action.type.toUpperCase()}  ${Math.round(action.power * 100)}%`, {
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: hardShot ? "21px" : "17px",
        fontStyle: "bold",
        color: hardShot ? "#ffd45c" : "#f6ffb5",
        stroke: "#173722",
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(46);

    for (let index = 0; index < (hardShot ? 12 : 7); index += 1) {
      const angle = (Math.PI * 2 * index) / (hardShot ? 12 : 7);
      const spark = this.scene.add.circle(this.sprite.x, this.sprite.y, hardShot ? 3 : 2, accent, 0.95).setDepth(45);
      this.scene.tweens.add({
        targets: spark,
        x: spark.x + Math.cos(angle) * (hardShot ? 48 : 30),
        y: spark.y + Math.sin(angle) * (hardShot ? 34 : 23),
        scale: 0.2,
        alpha: 0,
        duration: hardShot ? 300 : 230,
        ease: "Quad.easeOut",
        onComplete: () => spark.destroy(),
      });
    }

    this.scene.tweens.add({
      targets: ring,
      scale: 2.3,
      alpha: 0,
      duration: 230,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy(),
    });

    this.scene.tweens.add({
      targets: label,
      y: label.y - 22,
      scale: 1.2,
      alpha: 0,
      duration: 360,
      ease: "Quad.easeOut",
      onComplete: () => label.destroy(),
    });
  }

  private showBounce(color = 0xdfff3f): void {
    const ring = this.scene.add
      .ellipse(this.shadow.x, this.shadow.y, 18, 7, color, 0.08)
      .setStrokeStyle(3, color, 0.82)
      .setDepth(27);

    this.scene.tweens.add({
      targets: ring,
      scaleX: 2.5,
      scaleY: 1.7,
      alpha: 0,
      duration: 260,
      onComplete: () => ring.destroy(),
    });

    for (let index = 0; index < 5; index += 1) {
      const blade = this.scene.add.circle(this.shadow.x, this.shadow.y, 2, color, 0.9).setDepth(27);
      this.scene.tweens.add({
        targets: blade,
        x: blade.x + (index - 2) * 9,
        y: blade.y - 8 - (index % 2) * 5,
        alpha: 0,
        duration: 240 + index * 18,
        onComplete: () => blade.destroy(),
      });
    }
  }

  private showFrameClip(action: GameAction): void {
    if (this.lateFrameShown) {
      return;
    }

    this.lateFrameShown = true;
    this.missDeflection = action.type === "forehand" ? 0.13 : -0.13;
    const ring = this.scene.add.circle(this.sprite.x, this.sprite.y, 9, 0xf09a5a, 0.12)
      .setStrokeStyle(4, 0xf09a5a, 1)
      .setDepth(60);
    const label = this.scene.add.text(this.sprite.x, this.sprite.y - 24, "FRAME!", {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: "18px",
      fontStyle: "bold",
      color: "#ffd0a8",
      stroke: "#5a2018",
      strokeThickness: 5,
    }).setOrigin(0.5).setDepth(61);

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

  private renderAt(progress: number): void {
    const nearToFar = this.direction === "near-to-far";
    const fromDepth = nearToFar ? 0.89 : 0.11;
    const toDepth = nearToFar ? 0.11 : 0.89;
    const courtDepth = Phaser.Math.Linear(fromDepth, toDepth, progress);
    const courtX = Phaser.Math.Linear(this.fromX, this.toX, progress);
    const groundPosition = this.projectToScreen(courtX, courtDepth);
    const height = this.trajectoryHeight(progress);
    const perspective = Phaser.Math.Linear(0.56, 1, courtDepth);
    const renderedHeight = height * perspective;

    this.shadow.setPosition(groundPosition.x, groundPosition.y + 3);
    this.shadow.setScale(
      perspective * Phaser.Math.Linear(0.6, 1, 1 - Math.min(height / this.arcHeight, 1)),
      perspective,
    );
    this.shadow.setAlpha(Phaser.Math.Linear(0.18, 0.42, 1 - Math.min(height / this.arcHeight, 1)));
    this.shadow.setDepth(courtDepth < this.netDepth() ? 12 : 24);

    this.sprite.setPosition(groundPosition.x, groundPosition.y - renderedHeight);
    this.sprite.setScale(perspective);

    if (this.state === "in-flight" && progress > 0) {
      this.trailPoints.push(new Phaser.Math.Vector2(this.sprite.x, this.sprite.y));
      if (this.trailPoints.length > 12) {
        this.trailPoints.shift();
      }
      this.drawTrail(perspective);
    }
  }

  private renderMiss(progress: number): void {
    const nearReceiver = this.receiver === 1;
    const fromDepth = nearReceiver ? 0.89 : 0.11;
    const toDepth = nearReceiver ? 1.12 : -0.1;
    const courtDepth = Phaser.Math.Linear(fromDepth, toDepth, progress);
    const driftDirection = this.toX >= 0 ? 1 : -1;
    const courtX = this.toX + (driftDirection * 0.05 + this.missDeflection) * progress;
    const groundPosition = this.projectToScreen(courtX, courtDepth);
    const firstDrop = progress <= 0.52
      ? CONTACT_HEIGHT * (1 - progress / 0.52)
      : 10 * Math.sin(Math.PI * ((progress - 0.52) / 0.48));
    const perspective = Phaser.Math.Clamp(Phaser.Math.Linear(0.56, 1, courtDepth), 0.46, 1.12);

    this.shadow.setPosition(groundPosition.x, groundPosition.y + 3);
    this.shadow.setScale(perspective, perspective);
    this.shadow.setAlpha(0.42);
    this.sprite.setPosition(groundPosition.x, groundPosition.y - Math.max(0, firstDrop) * perspective);
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
      const intensity = Phaser.Math.Linear(0.24, 0.46, this.shotPower);
      this.trail.fillStyle(0xdfff3f, age * intensity);
      this.trail.fillCircle(point.x, point.y, perspective * age * Phaser.Math.Linear(4.5, 7.5, this.shotPower));
    });
  }

  private showLandingMarker(): void {
    this.destroyLandingMarker();
    const nearToFar = this.direction === "near-to-far";
    const fromDepth = nearToFar ? 0.89 : 0.11;
    const toDepth = nearToFar ? 0.11 : 0.89;
    const bounceDepth = Phaser.Math.Linear(fromDepth, toDepth, BOUNCE_PROGRESS);
    const point = this.projectToScreen(this.toX, bounceDepth);
    this.landingMarker = this.scene.add.ellipse(point.x, point.y + 2, 34, 12, 0xdfff3f, 0.08)
      .setStrokeStyle(2, 0xdfff3f, 0.58)
      .setDepth(bounceDepth < this.netDepth() ? 11 : 23);
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

  private trajectoryHeight(progress: number): number {
    if (progress <= BOUNCE_PROGRESS) {
      const flightProgress = progress / BOUNCE_PROGRESS;
      const contactHeight = CONTACT_HEIGHT * (1 - flightProgress);
      const arc = 4 * this.arcHeight * flightProgress * (1 - flightProgress);

      return contactHeight + arc;
    }

    const reboundProgress = (progress - BOUNCE_PROGRESS) / (1 - BOUNCE_PROGRESS);
    const contactHeight = CONTACT_HEIGHT * reboundProgress;
    const reboundArc = 4 * this.reboundHeight * reboundProgress * (1 - reboundProgress);

    return contactHeight + reboundArc;
  }

  private projectToScreen(courtX: number, courtDepth: number): Phaser.Math.Vector2 {
    const leftEdge = Phaser.Math.Linear(COURT.farLeft, COURT.nearLeft, courtDepth);
    const rightEdge = Phaser.Math.Linear(COURT.farRight, COURT.nearRight, courtDepth);
    const usableHalfWidth = (rightEdge - leftEdge) * 0.42;

    return new Phaser.Math.Vector2(
      COURT.centreX + courtX * usableHalfWidth,
      Phaser.Math.Linear(COURT.farY, COURT.nearY, courtDepth),
    );
  }

  private netDepth(): number {
    return (COURT.netY - COURT.farY) / (COURT.nearY - COURT.farY);
  }
}
