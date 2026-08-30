import Phaser from "phaser";

export type PlayerSide = "near" | "far";

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
  public constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    side: PlayerSide,
  ) {
    this.drawShadow(scene, x, y, side);
    this.drawPlayer(scene, x, y, side);
  }

  private drawShadow(scene: Phaser.Scene, x: number, y: number, side: PlayerSide): void {
    const width = side === "near" ? 68 : 42;
    scene.add.ellipse(x, y + 30, width, side === "near" ? 18 : 11, 0x061a12, 0.42);
  }

  private drawPlayer(scene: Phaser.Scene, x: number, y: number, side: PlayerSide): void {
    const scale = side === "near" ? 1 : 0.7;
    const colors = PLAYER_COLORS[side];
    const graphics = scene.add.graphics({ x, y });

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

    this.drawRacket(graphics, scale, colors.accent);
  }

  private drawRacket(
    graphics: Phaser.GameObjects.Graphics,
    scale: number,
    accentColor: number,
  ): void {
    graphics.lineStyle(5 * scale, 0x8b5a2b, 1);
    graphics.beginPath();
    graphics.moveTo(24 * scale, 1 * scale);
    graphics.lineTo(39 * scale, 23 * scale);
    graphics.strokePath();

    graphics.lineStyle(4 * scale, accentColor, 1);
    graphics.strokeEllipse(46 * scale, 31 * scale, 25 * scale, 34 * scale);
    graphics.lineStyle(1 * scale, 0xf1ebcf, 0.75);
    graphics.beginPath();
    graphics.moveTo(39 * scale, 19 * scale);
    graphics.lineTo(52 * scale, 43 * scale);
    graphics.moveTo(52 * scale, 19 * scale);
    graphics.lineTo(40 * scale, 42 * scale);
    graphics.strokePath();
  }
}
