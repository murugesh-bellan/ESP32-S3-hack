import Phaser from "phaser";

import { Court } from "./Court";
import { Player } from "./Player";

const FONT_STACK = '"Courier New", Courier, monospace';

export class GameScene extends Phaser.Scene {
  public constructor() {
    super("GameScene");
  }

  public create(): void {
    this.drawBackdrop();
    new Court(this).draw();
    this.drawPlayersAndBall();
    this.drawHud();
  }

  private drawBackdrop(): void {
    this.add.rectangle(640, 52, 1280, 104, 0x071f18);
    this.add.rectangle(640, 102, 1280, 4, 0xe5d8aa);

    const crowd = this.add.graphics();
    const crowdColors = [0xd6c49a, 0x91414a, 0x33577b, 0xe5e1ca, 0x497452];
    for (let index = 0; index < 64; index += 1) {
      const x = 10 + index * 20;
      const color = crowdColors[index % crowdColors.length];
      crowd.fillStyle(color, 0.5);
      crowd.fillRect(x, 86 - (index % 3) * 3, 9, 6);
    }
  }

  private drawPlayersAndBall(): void {
    new Player(this, 640, 194, "far");
    new Player(this, 640, 617, "near");

    this.add.ellipse(640, 486, 21, 7, 0x071a12, 0.3);
    this.add.circle(640, 476, 8, 0xdfff3f);
    this.add.circle(637, 473, 2, 0xf5ffad, 0.9);
  }

  private drawHud(): void {
    const panelColor = 0x0b3428;
    const cream = "#f3e9ca";
    const gold = "#d9bd68";

    this.add.rectangle(178, 50, 286, 66, panelColor, 1)
      .setStrokeStyle(3, 0xd9bd68, 1);
    this.add.rectangle(1102, 50, 286, 66, panelColor, 1)
      .setStrokeStyle(3, 0xd9bd68, 1);

    this.add.text(54, 32, "PLAYER 1", {
      fontFamily: FONT_STACK,
      fontSize: "20px",
      fontStyle: "bold",
      color: cream,
    });
    this.add.text(287, 29, "0", {
      fontFamily: FONT_STACK,
      fontSize: "34px",
      fontStyle: "bold",
      color: gold,
    });

    this.add.text(978, 32, "PLAYER 2", {
      fontFamily: FONT_STACK,
      fontSize: "20px",
      fontStyle: "bold",
      color: cream,
    });
    this.add.text(1211, 29, "0", {
      fontFamily: FONT_STACK,
      fontSize: "34px",
      fontStyle: "bold",
      color: gold,
    });

    this.add.text(640, 20, "TINY TENNIS", {
      fontFamily: FONT_STACK,
      fontSize: "28px",
      fontStyle: "bold",
      color: cream,
      stroke: "#0b3428",
      strokeThickness: 5,
    }).setOrigin(0.5, 0);

    this.add.text(640, 57, "REAL SWINGS  •  TINY AI  •  BIG RALLIES", {
      fontFamily: FONT_STACK,
      fontSize: "13px",
      fontStyle: "bold",
      color: "#d9bd68",
      letterSpacing: 1,
    }).setOrigin(0.5, 0);

    this.add.text(640, 704, "CHAMPIONSHIP GRASS COURT", {
      fontFamily: FONT_STACK,
      fontSize: "12px",
      fontStyle: "bold",
      color: "#b7c9ac",
      letterSpacing: 2,
    }).setOrigin(0.5, 1);
  }
}
