import Phaser from "phaser";

const SHIRT_COLORS = [0xe5d6ad, 0x9d4250, 0x365d82, 0xf0ead2, 0x4d7b58, 0xd08a46] as const;
const SKIN_COLORS = [0xe1a06f, 0xb96f47, 0x8f5238, 0xf0bb87] as const;

export class Stadium {
  private readonly crowd: Phaser.GameObjects.Container[] = [];
  private umpire?: Phaser.GameObjects.Container;

  public constructor(private readonly scene: Phaser.Scene) {}

  public draw(): void {
    this.drawStands();
    this.drawCrowd();
    this.drawUmpireChair();
  }

  public reactCrowd(intensity = 1): void {
    this.crowd.forEach((spectator, index) => {
      if (index % 2 !== 0 && intensity < 1) {
        return;
      }

      this.scene.tweens.add({
        targets: spectator,
        angle: index % 2 === 0 ? -5 * intensity : 5 * intensity,
        scaleY: spectator.scaleY + 0.08 * intensity,
        duration: 90 + (index % 4) * 18,
        yoyo: true,
        ease: "Quad.easeOut",
      });
    });
  }

  public signalPoint(): void {
    if (!this.umpire) {
      return;
    }

    this.scene.tweens.add({
      targets: this.umpire,
      angle: -8,
      y: this.umpire.y - 3,
      duration: 150,
      yoyo: true,
      hold: 140,
      ease: "Back.easeOut",
    });
  }

  private drawStands(): void {
    const stands = this.scene.add.graphics().setDepth(2);

    stands.fillStyle(0x08251c, 0.95);
    stands.fillPoints([
      new Phaser.Math.Vector2(0, 124),
      new Phaser.Math.Vector2(378, 145),
      new Phaser.Math.Vector2(236, 430),
      new Phaser.Math.Vector2(0, 500),
    ], true);
    stands.fillPoints([
      new Phaser.Math.Vector2(902, 145),
      new Phaser.Math.Vector2(1280, 124),
      new Phaser.Math.Vector2(1280, 500),
      new Phaser.Math.Vector2(1044, 430),
    ], true);

    stands.lineStyle(4, 0xd9bd68, 0.78);
    stands.lineBetween(0, 128, 378, 149);
    stands.lineBetween(902, 149, 1280, 128);
    stands.lineStyle(2, 0x426c55, 0.7);
    for (let row = 0; row < 5; row += 1) {
      const y = 171 + row * 51;
      const inset = 26 + row * 28;
      stands.lineBetween(0, y, 342 - inset, y + 10);
      stands.lineBetween(938 + inset, y + 10, 1280, y);
    }
  }

  private drawCrowd(): void {
    let spectatorIndex = 0;
    for (let row = 0; row < 5; row += 1) {
      const y = 151 + row * 51;
      const inwardLimit = 320 - row * 27;
      const scale = 0.54 + row * 0.055;

      for (let column = 0; column < 5; column += 1) {
        const x = 34 + column * ((inwardLimit - 52) / 4);
        this.crowd.push(this.createSpectator(x, y + (column % 2) * 5, scale, spectatorIndex));
        spectatorIndex += 1;
        this.crowd.push(this.createSpectator(1280 - x, y + ((column + 1) % 2) * 5, scale, spectatorIndex));
        spectatorIndex += 1;
      }
    }
  }

  private createSpectator(
    x: number,
    y: number,
    scale: number,
    index: number,
  ): Phaser.GameObjects.Container {
    const shirtColor = SHIRT_COLORS[index % SHIRT_COLORS.length];
    const skinColor = SKIN_COLORS[index % SKIN_COLORS.length];
    const body = this.scene.add.rectangle(0, 7, 16, 15, shirtColor, 0.92);
    const head = this.scene.add.circle(0, -4, 6, skinColor, 1);
    const hair = this.scene.add.rectangle(0, -8, 11, 3, index % 3 === 0 ? 0x31251f : 0x6d4930, 1);
    const spectator = this.scene.add.container(x, y, [body, head, hair]).setScale(scale).setDepth(3 + index % 5);

    if (index % 4 === 0) {
      this.scene.tweens.add({
        targets: spectator,
        y: y - 2,
        duration: 850 + (index % 5) * 110,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }

    return spectator;
  }

  private drawUmpireChair(): void {
    const chair = this.scene.add.graphics().setDepth(21);
    const chairX = 1042;
    const chairY = 342;

    chair.lineStyle(6, 0xe5d8aa, 1);
    chair.lineBetween(chairX - 18, chairY + 15, chairX - 30, chairY + 94);
    chair.lineBetween(chairX + 18, chairY + 15, chairX + 30, chairY + 94);
    chair.lineBetween(chairX - 24, chairY + 66, chairX + 24, chairY + 66);
    chair.fillStyle(0x173f31, 1);
    chair.fillRect(chairX - 24, chairY + 7, 48, 12);
    chair.fillStyle(0xd9bd68, 1);
    chair.fillRect(chairX - 27, chairY + 4, 54, 5);

    const body = this.scene.add.rectangle(0, 4, 29, 30, 0x233d72, 1);
    const shirtStripe = this.scene.add.rectangle(0, 5, 29, 5, 0xf3e9ca, 1);
    const head = this.scene.add.circle(0, -18, 10, 0xc98252, 1);
    const cap = this.scene.add.rectangle(0, -25, 22, 5, 0xf3e9ca, 1);
    const arm = this.scene.add.rectangle(-18, -1, 18, 6, 0xc98252, 1).setAngle(-18);
    this.umpire = this.scene.add.container(chairX, chairY - 13, [body, shirtStripe, head, cap, arm]).setDepth(22);

    this.scene.tweens.add({
      targets: this.umpire,
      y: this.umpire.y - 2,
      duration: 1_450,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });

    this.scene.add.text(chairX, chairY + 85, "UMPIRE", {
      fontFamily: '"Courier New", Courier, monospace',
      fontSize: "8px",
      fontStyle: "bold",
      color: "#d9bd68",
    }).setOrigin(0.5).setDepth(22);
  }
}
