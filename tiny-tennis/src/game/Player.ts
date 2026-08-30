import Phaser from "phaser";

import type { ShotType } from "../input/GameAction";

export type PlayerSide = "near" | "far";

const MOVE_SPEED_PER_SECOND = 1.35;

const PLAYER_COLORS = {
  near: {
    shirt: 0xf3eee0,
    accent: 0x9f2633,
    skin: 0xc77c4c,
    shorts: 0x173d69,
  },
  far: {
    shirt: 0x263f77,
    accent: 0xf2e6c4,
    skin: 0x9d5b3a,
    shorts: 0xf0e8d2,
  },
} as const;

export class Player {
  private readonly container: Phaser.GameObjects.Container;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly racket: Phaser.GameObjects.Container;
  private readonly backhandArm: Phaser.GameObjects.Graphics;
  private readonly visualScale: number;
  private courtX = 0;
  private targetCourtX = 0;
  private swingTween?: Phaser.Tweens.Tween;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly baseX: number,
    private readonly baseY: number,
    private readonly side: PlayerSide,
  ) {
    const scale = side === "near" ? 1 : 0.7;
    this.visualScale = scale;
    const colors = PLAYER_COLORS[side];
    const body = this.drawBody(scale, colors);
    this.backhandArm = this.drawBackhandArm(scale, colors.skin).setVisible(false);
    this.racket = this.drawRacket(scale, colors.accent);

    this.container = scene.add
      .container(baseX, baseY, [body, this.backhandArm, this.racket])
      .setDepth(side === "near" ? 31 : 9);

    this.shadow = scene.add
      .ellipse(baseX, baseY + 30, side === "near" ? 68 : 42, side === "near" ? 18 : 11, 0x061a12, 0.42)
      .setDepth(side === "near" ? 30 : 8);

    scene.tweens.add({
      targets: this.shadow,
      scaleX: 1.08,
      alpha: 0.34,
      duration: side === "near" ? 920 : 1_080,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  public update(deltaMs: number): void {
    const maximumStep = MOVE_SPEED_PER_SECOND * (deltaMs / 1_000);
    const distance = this.targetCourtX - this.courtX;

    if (Math.abs(distance) <= maximumStep) {
      this.courtX = this.targetCourtX;
    } else {
      this.courtX += Math.sign(distance) * maximumStep;
    }

    const screenX = this.baseX + this.courtX * (this.side === "near" ? 360 : 170);
    this.container.x = screenX;
    this.shadow.x = screenX;
  }

  public moveToCourtX(courtX: number): void {
    this.targetCourtX = Phaser.Math.Clamp(courtX, -0.78, 0.78);
  }

  public getCourtX(): number {
    return this.courtX;
  }

  public reactToMiss(): void {
    this.scene.tweens.add({
      targets: this.container,
      angle: this.side === "near" ? -7 : 7,
      alpha: 0.72,
      duration: 120,
      yoyo: true,
      hold: 80,
      ease: "Quad.easeOut",
    });
  }

  public celebrate(): void {
    this.scene.tweens.add({
      targets: this.container,
      y: this.baseY - (this.side === "near" ? 14 : 9),
      duration: 150,
      yoyo: true,
      repeat: 1,
      ease: "Quad.easeOut",
    });
  }

  public swing(type: ShotType): void {
    this.swingTween?.stop();

    const swingAngles: Record<ShotType, { start: number; end: number; duration: number }> = {
      forehand: { start: -115, end: 78, duration: 240 },
      backhand: { start: 118, end: -55, duration: 275 },
      serve: { start: -168, end: 62, duration: 270 },
    };
    const angles = swingAngles[type];

    if (type === "backhand") {
      this.backhandArm.setVisible(true);
      this.racket.setPosition(-4 * this.visualScale, -5 * this.visualScale);
      this.racket.setScale(1, 1);
    } else {
      this.backhandArm.setVisible(false);
      this.racket.setPosition(24 * this.visualScale, 1 * this.visualScale);
      this.racket.setScale(1, 1);
    }

    this.racket.setAngle(angles.start);
    this.swingTween = this.scene.tweens.add({
      targets: this.racket,
      angle: angles.end,
      duration: angles.duration,
      ease: "Sine.easeInOut",
      yoyo: true,
      hold: 70,
      onComplete: () => this.resetRacketPose(),
    });
  }

  private resetRacketPose(): void {
    this.racket.setPosition(24 * this.visualScale, 1 * this.visualScale);
    this.racket.setScale(1, 1);
    this.racket.setAngle(0);
    this.backhandArm.setVisible(false);
  }

  private drawBackhandArm(scale: number, skinColor: number): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics();

    graphics.lineStyle(8 * scale, skinColor, 1);
    graphics.beginPath();
    graphics.moveTo(-18 * scale, -20 * scale);
    graphics.lineTo(-3 * scale, -7 * scale);
    graphics.lineTo(5 * scale, -3 * scale);
    graphics.strokePath();

    return graphics;
  }

  private drawBody(
    scale: number,
    colors: (typeof PLAYER_COLORS)[PlayerSide],
  ): Phaser.GameObjects.Graphics {
    const graphics = this.scene.add.graphics();

    graphics.fillStyle(colors.skin, 1);
    graphics.fillRect(-9 * scale, -44 * scale, 18 * scale, 16 * scale);
    graphics.fillStyle(0x38281f, 1);
    graphics.fillRect(-10 * scale, -48 * scale, 20 * scale, 7 * scale);

    graphics.fillStyle(colors.shirt, 1);
    graphics.fillRect(-18 * scale, -28 * scale, 36 * scale, 31 * scale);
    graphics.fillStyle(colors.accent, 1);
    graphics.fillRect(-18 * scale, -12 * scale, 36 * scale, 6 * scale);

    graphics.fillStyle(colors.skin, 1);
    graphics.fillRect(-27 * scale, -23 * scale, 9 * scale, 29 * scale);
    graphics.fillRect(18 * scale, -23 * scale, 9 * scale, 29 * scale);

    graphics.fillStyle(colors.shorts, 1);
    graphics.fillRect(-17 * scale, 3 * scale, 34 * scale, 17 * scale);

    graphics.fillStyle(0xe9e2cd, 1);
    graphics.fillRect(-16 * scale, 20 * scale, 10 * scale, 24 * scale);
    graphics.fillRect(6 * scale, 20 * scale, 10 * scale, 24 * scale);
    graphics.fillStyle(0xf9f4df, 1);
    graphics.fillRect(-19 * scale, 42 * scale, 15 * scale, 7 * scale);
    graphics.fillRect(4 * scale, 42 * scale, 15 * scale, 7 * scale);

    return graphics;
  }

  private drawRacket(scale: number, accentColor: number): Phaser.GameObjects.Container {
    const graphics = this.scene.add.graphics();

    graphics.lineStyle(5 * scale, 0x8b5a2b, 1);
    graphics.beginPath();
    graphics.moveTo(0, 0);
    graphics.lineTo(15 * scale, 22 * scale);
    graphics.strokePath();

    graphics.lineStyle(4 * scale, accentColor, 1);
    graphics.strokeEllipse(22 * scale, 30 * scale, 25 * scale, 34 * scale);
    graphics.lineStyle(1 * scale, 0xf1ebcf, 0.75);
    graphics.beginPath();
    graphics.moveTo(15 * scale, 18 * scale);
    graphics.lineTo(28 * scale, 42 * scale);
    graphics.moveTo(28 * scale, 18 * scale);
    graphics.lineTo(16 * scale, 41 * scale);
    graphics.strokePath();

    return this.scene.add.container(24 * scale, 1 * scale, [graphics]);
  }
}
