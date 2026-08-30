import Phaser from "phaser";

const FONT_STACK = '"Courier New", Courier, monospace';

export function createUiButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string,
  onClick: () => void,
): Phaser.GameObjects.Container {
  const background = scene.add
    .rectangle(0, 0, width, height, 0x123f2e, 0.98)
    .setStrokeStyle(3, 0xd9bd68, 1);
  const text = scene.add.text(0, 0, label, {
    fontFamily: FONT_STACK,
    fontSize: "17px",
    fontStyle: "bold",
    color: "#f3e9ca",
    align: "center",
  }).setOrigin(0.5);

  const button = scene.add
    .container(x, y, [background, text])
    .setSize(width, height)
    .setInteractive({ useHandCursor: true })
    .setDepth(200);

  button.on("pointerover", () => {
    background.setFillStyle(0x1d6041, 1);
    text.setColor("#fff8d8");
  });
  button.on("pointerout", () => {
    background.setFillStyle(0x123f2e, 0.98);
    text.setColor("#f3e9ca");
  });
  button.on("pointerdown", () => background.setScale(0.97));
  button.on("pointerup", () => {
    background.setScale(1);
    onClick();
  });

  return button;
}
