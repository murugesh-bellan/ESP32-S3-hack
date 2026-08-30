import Phaser from "phaser";

const COLORS = {
  surround: 0x0b3927,
  surroundDark: 0x082d20,
  court: 0x2f7b45,
  courtBand: 0x357f49,
  line: 0xf4efcf,
  lineShadow: 0x163f28,
  net: 0x10271e,
  netLight: 0xe8e5ca,
  post: 0xe8dec0,
};

export const COURT = {
  farY: 154,
  nearY: 672,
  netY: 397,
  farLeft: 396,
  farRight: 884,
  nearLeft: 126,
  nearRight: 1154,
  centreX: 640,
} as const;

type Point = { x: number; y: number };

export class Court {
  public constructor(private readonly scene: Phaser.Scene) {}

  public draw(): void {
    const courtGraphics = this.scene.add.graphics().setDepth(0);
    const netGraphics = this.scene.add.graphics().setDepth(20);

    this.drawSurround(courtGraphics);
    this.drawPlayingSurface(courtGraphics);
    this.drawCourtLines(courtGraphics);
    this.drawNet(netGraphics);
  }

  private drawSurround(graphics: Phaser.GameObjects.Graphics): void {
    graphics.fillStyle(COLORS.surround, 1);
    graphics.fillRect(0, 104, 1280, 616);

    for (let y = 112; y < 720; y += 42) {
      const alternatingColor = Math.floor((y - 112) / 42) % 2 === 0
        ? COLORS.surroundDark
        : COLORS.surround;
      graphics.fillStyle(alternatingColor, 0.32);
      graphics.fillRect(0, y, 1280, 21);
    }

    graphics.fillStyle(0x061d16, 0.46);
    graphics.fillRect(0, 104, 1280, 24);
  }

  private drawPlayingSurface(graphics: Phaser.GameObjects.Graphics): void {
    const corners = this.courtCorners();

    graphics.fillStyle(COLORS.lineShadow, 0.55);
    graphics.fillPoints(
      this.vectors(corners.map(({ x, y }) => ({ x: x + 7, y: y + 8 }))),
      true,
    );

    graphics.fillStyle(COLORS.court, 1);
    graphics.fillPoints(this.vectors(corners), true);

    const bandCount = 12;
    for (let index = 0; index < bandCount; index += 1) {
      if (index % 2 === 1) {
        continue;
      }

      const topProgress = index / bandCount;
      const bottomProgress = (index + 1) / bandCount;
      const band = [
        this.edgePoint(topProgress, "left"),
        this.edgePoint(topProgress, "right"),
        this.edgePoint(bottomProgress, "right"),
        this.edgePoint(bottomProgress, "left"),
      ];

      graphics.fillStyle(COLORS.courtBand, 0.42);
      graphics.fillPoints(this.vectors(band), true);
    }
  }

  private drawCourtLines(graphics: Phaser.GameObjects.Graphics): void {
    const corners = this.courtCorners();
    const farService = 0.255;
    const nearService = 0.745;
    const singlesInset = 0.095;

    graphics.lineStyle(5, COLORS.lineShadow, 0.38);
    graphics.strokePoints(
      this.vectors(corners.map(({ x, y }) => ({ x: x + 2, y: y + 3 }))),
      true,
    );

    graphics.lineStyle(4, COLORS.line, 1);
    graphics.strokePoints(this.vectors(corners), true);

    const leftSinglesFar = this.widthPoint(0, singlesInset);
    const leftSinglesNear = this.widthPoint(1, singlesInset);
    const rightSinglesFar = this.widthPoint(0, 1 - singlesInset);
    const rightSinglesNear = this.widthPoint(1, 1 - singlesInset);

    this.line(graphics, leftSinglesFar, leftSinglesNear, 3);
    this.line(graphics, rightSinglesFar, rightSinglesNear, 3);

    const farServiceLeft = this.widthPoint(farService, singlesInset);
    const farServiceRight = this.widthPoint(farService, 1 - singlesInset);
    const nearServiceLeft = this.widthPoint(nearService, singlesInset);
    const nearServiceRight = this.widthPoint(nearService, 1 - singlesInset);

    this.line(graphics, farServiceLeft, farServiceRight, 3);
    this.line(graphics, nearServiceLeft, nearServiceRight, 3);

    this.line(
      graphics,
      this.widthPoint(farService, 0.5),
      this.widthPoint(nearService, 0.5),
      3,
    );

    const farBaselineCentre = this.widthPoint(0, 0.5);
    const nearBaselineCentre = this.widthPoint(1, 0.5);
    this.line(
      graphics,
      { x: farBaselineCentre.x, y: farBaselineCentre.y - 2 },
      { x: farBaselineCentre.x, y: farBaselineCentre.y + 10 },
      3,
    );
    this.line(
      graphics,
      { x: nearBaselineCentre.x, y: nearBaselineCentre.y - 14 },
      { x: nearBaselineCentre.x, y: nearBaselineCentre.y + 2 },
      3,
    );
  }

  private drawNet(graphics: Phaser.GameObjects.Graphics): void {
    const progress = (COURT.netY - COURT.farY) / (COURT.nearY - COURT.farY);
    const left = this.edgePoint(progress, "left").x - 24;
    const right = this.edgePoint(progress, "right").x + 24;
    const topY = COURT.netY - 28;
    const bottomY = COURT.netY + 11;

    graphics.fillStyle(COLORS.net, 0.55);
    graphics.fillRect(left, topY + 5, right - left, bottomY - topY);

    graphics.lineStyle(1, COLORS.netLight, 0.38);
    for (let x = left + 8; x < right; x += 16) {
      this.line(graphics, { x, y: topY + 4 }, { x, y: bottomY }, 1);
    }
    for (let y = topY + 10; y < bottomY; y += 9) {
      this.line(graphics, { x: left, y }, { x: right, y }, 1);
    }

    graphics.fillStyle(COLORS.post, 1);
    graphics.fillRect(left - 6, topY - 4, 10, bottomY - topY + 19);
    graphics.fillRect(right - 4, topY - 4, 10, bottomY - topY + 19);
    graphics.fillStyle(COLORS.netLight, 1);
    graphics.fillRect(left - 6, topY - 6, right - left + 12, 6);
  }

  private line(
    graphics: Phaser.GameObjects.Graphics,
    start: Point,
    end: Point,
    width: number,
  ): void {
    graphics.lineStyle(width, COLORS.line, 1);
    graphics.beginPath();
    graphics.moveTo(start.x, start.y);
    graphics.lineTo(end.x, end.y);
    graphics.strokePath();
  }

  private courtCorners(): Point[] {
    return [
      { x: COURT.farLeft, y: COURT.farY },
      { x: COURT.farRight, y: COURT.farY },
      { x: COURT.nearRight, y: COURT.nearY },
      { x: COURT.nearLeft, y: COURT.nearY },
    ];
  }

  private vectors(points: Point[]): Phaser.Math.Vector2[] {
    return points.map(({ x, y }) => new Phaser.Math.Vector2(x, y));
  }

  private edgePoint(progress: number, edge: "left" | "right"): Point {
    const far = edge === "left" ? COURT.farLeft : COURT.farRight;
    const near = edge === "left" ? COURT.nearLeft : COURT.nearRight;

    return {
      x: Phaser.Math.Linear(far, near, progress),
      y: Phaser.Math.Linear(COURT.farY, COURT.nearY, progress),
    };
  }

  private widthPoint(progress: number, widthProgress: number): Point {
    const left = this.edgePoint(progress, "left");
    const right = this.edgePoint(progress, "right");

    return {
      x: Phaser.Math.Linear(left.x, right.x, widthProgress),
      y: left.y,
    };
  }
}
