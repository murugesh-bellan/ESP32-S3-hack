import Phaser from "phaser";

import { playBallHit, playBounce, playOut, playWon, preloadCourtSounds } from "../audio/GameAudio";
import { ScoreAnnouncer } from "../audio/ScoreAnnouncer";
import type { GameAction, PlayerId } from "../input/GameAction";
import type { InputAdapter } from "../input/InputAdapter";
import { KeyboardInputAdapter } from "../input/KeyboardInputAdapter";
import { WebSocketInputAdapter } from "../input/WebSocketInputAdapter";
import { addMenuExit } from "../ui/addMenuExit";
import { createUiButton } from "../ui/UiButton";
import { Ball, type HitResult } from "./Ball";
import { Court } from "./Court";
import { Player } from "./Player";
import { Score, type TennisOpponent } from "./Score";
import { Stadium } from "./Stadium";

const FONT_STACK = '"Courier New", Courier, monospace';
const INTERCEPT_OFFSET = 0.1;

export type GameMode = "computer" | "local";

interface GameSceneData {
  mode?: GameMode;
}

export class GameScene extends Phaser.Scene {
  private mode: GameMode = "local";
  private ball!: Ball;
  private players!: Record<PlayerId, Player>;
  private score!: Score;
  private announcer!: ScoreAnnouncer;
  private stadium!: Stadium;
  private scoreTexts!: Record<PlayerId, Phaser.GameObjects.Text>;
  private scoreStatusText!: Phaser.GameObjects.Text;
  private rallyText!: Phaser.GameObjects.Text;
  private inputAdapters: InputAdapter[] = [];
  private actionText!: Phaser.GameObjects.Text;
  private actionDetailText!: Phaser.GameObjects.Text;
  private controllerStatusText?: Phaser.GameObjects.Text;
  private actionResetTimer?: Phaser.Time.TimerEvent;
  private restartTimer?: Phaser.Time.TimerEvent;
  private server: PlayerId = 1;
  private matchOver = false;
  private computerHasActed = false;
  private computerReturnCount = 0;
  private rallyCount = 0;

  public constructor() {
    super("GameScene");
  }

  public init(data: GameSceneData): void {
    this.mode = data.mode ?? "local";
  }

  public preload(): void {
    preloadCourtSounds(this);
  }

  public create(): void {
    this.server = 1;
    this.matchOver = false;
    this.computerHasActed = false;
    this.computerReturnCount = 0;
    this.rallyCount = 0;
    this.actionResetTimer = undefined;
    this.restartTimer = undefined;
    this.score = new Score();
    this.announcer = new ScoreAnnouncer();

    this.cameras.main.fadeIn(220, 7, 31, 24);
    this.drawBackdrop();
    new Court(this).draw();
    this.stadium = new Stadium(this);
    this.stadium.draw();
    this.drawPlayers();
    this.ball = new Ball(
      this,
      (missedPlayer) => this.handleMiss(missedPlayer),
      () => playBounce(this),
    );
    this.drawHud();
    this.createActionMonitor();
    this.createControllerStatus();
    this.startInput();
    addMenuExit(this);
    this.showServePrompt();
    this.time.delayedCall(420, () => {
      if (!this.matchOver) {
        this.announcer.announce(this.score.getCallout(this.opponentVoice()));
      }
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.announcer.stop());
  }

  public update(_time: number, delta: number): void {
    this.ball.update(delta);
    this.players[1].update(delta);
    this.players[2].update(delta);
    this.updateComputerOpponent();
  }

  private drawBackdrop(): void {
    this.add.rectangle(640, 52, 1280, 104, 0x071f18);
    this.add.rectangle(640, 102, 1280, 4, 0xe5d8aa);

  }

  private drawPlayers(): void {
    this.players = {
      1: new Player(this, 640, 617, "near"),
      2: new Player(this, 640, 194, "far"),
    };
  }

  private drawHud(): void {
    const panelColor = 0x0b3428;
    const cream = "#f3e9ca";
    const gold = "#dfff3f";
    const playerTwoLabel = this.mode === "computer" ? "COMPUTER" : "PLAYER 2";

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
    this.add.text(958, 32, playerTwoLabel, {
      fontFamily: FONT_STACK,
      fontSize: "20px",
      fontStyle: "bold",
      color: cream,
    });

    this.scoreTexts = {
      1: this.add.text(300, 28, this.score.getDisplay(1), {
        fontFamily: FONT_STACK,
        fontSize: "30px",
        fontStyle: "bold",
        color: gold,
      }).setOrigin(1, 0),
      2: this.add.text(1_218, 28, this.score.getDisplay(2), {
        fontFamily: FONT_STACK,
        fontSize: "30px",
        fontStyle: "bold",
        color: gold,
      }).setOrigin(1, 0),
    };

    this.add.text(640, 17, "TINY TENNIS", {
      fontFamily: FONT_STACK,
      fontSize: "26px",
      fontStyle: "bold",
      color: cream,
      stroke: "#0b3428",
      strokeThickness: 5,
    }).setOrigin(0.5, 0);

    this.add.text(640, 52, `${this.mode === "computer" ? "LEVEL 2 • VS COMPUTER" : "LEVEL 3 • TWO PLAYERS"}  •  ONE TENNIS GAME`, {
      fontFamily: FONT_STACK,
      fontSize: "12px",
      fontStyle: "bold",
      color: "#d9bd68",
      letterSpacing: 1,
    }).setOrigin(0.5, 0);

    this.scoreStatusText = this.add.text(640, 72, this.score.getStatusLabel(playerTwoLabel), {
      fontFamily: FONT_STACK,
      fontSize: "13px",
      fontStyle: "bold",
      color: "#dfff3f",
      letterSpacing: 2,
    }).setOrigin(0.5, 0).setDepth(102);

    this.rallyText = this.add.text(640, 91, "RALLY  0", {
      fontFamily: FONT_STACK,
      fontSize: "9px",
      fontStyle: "bold",
      color: "#7fa38b",
      letterSpacing: 2,
    }).setOrigin(0.5, 0).setDepth(102);

    const controlLine = this.mode === "computer"
      ? "P1: F FOREHAND • B BACKHAND • S SERVE • AIM A/D"
      : "P1: F/B/S • AIM A/D     P2: ←/→/↑ • AIM J/L";
    this.add.text(640, 704, controlLine, {
      fontFamily: FONT_STACK,
      fontSize: "11px",
      fontStyle: "bold",
      color: "#b7c9ac",
      letterSpacing: 1,
    }).setOrigin(0.5, 1).setDepth(100);

    this.add.text(640, 686, "POWER: SPACE + SHOT SOFT  •  SHOT NORMAL  •  SHIFT + SHOT HARD", {
      fontFamily: FONT_STACK,
      fontSize: "11px",
      fontStyle: "bold",
      color: "#b7c9ac",
      letterSpacing: 1,
    }).setOrigin(0.5, 1).setDepth(100);
  }

  private createActionMonitor(): void {
    this.add.rectangle(640, 127, 478, 54, 0x071f18, 0.9)
      .setStrokeStyle(2, 0xd9bd68, 0.8)
      .setDepth(100);

    this.actionText = this.add.text(640, 109, "", {
      fontFamily: FONT_STACK,
      fontSize: "16px",
      fontStyle: "bold",
      color: "#f3e9ca",
    }).setOrigin(0.5, 0).setDepth(101);

    this.actionDetailText = this.add.text(640, 132, "", {
      fontFamily: FONT_STACK,
      fontSize: "10px",
      fontStyle: "bold",
      color: "#b7c9ac",
      letterSpacing: 1,
    }).setOrigin(0.5, 0).setDepth(101);
  }

  private startInput(): void {
    const keyboard = new KeyboardInputAdapter();
    this.inputAdapters = [keyboard];
    const params = new URLSearchParams(window.location.search);
    const room = params.get("room")?.trim();
    if (room) {
      this.inputAdapters.push(new WebSocketInputAdapter({
        room,
        token: params.get("token") ?? undefined,
        onStatus: (status) => this.controllerStatusText?.setText(`CONTROLLER LINK  ${status.toUpperCase()}`).setColor(status === "connected" ? "#dfff3f" : "#ffb86b"),
        onShot: (action) => this.controllerStatusText?.setText(`CONTROLLER LINK  CONNECTED  •  P${action.player} ${action.type.toUpperCase()} ${Math.round(action.power * 100)}%`),
      }));
    }

    this.inputAdapters.forEach((adapter) => adapter.start((action) => this.handleAction(action)));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.inputAdapters.forEach((adapter) => adapter.stop());
      this.inputAdapters = [];
    });
  }

  private createControllerStatus(): void {
    const room = new URLSearchParams(window.location.search).get("room")?.trim();
    if (!room) return;
    this.controllerStatusText = this.add.text(640, 16, `CONTROLLER LINK  CONNECTING  •  ROOM ${room}`, {
      fontFamily: FONT_STACK, fontSize: "11px", fontStyle: "bold", color: "#ffb86b", letterSpacing: 1,
    }).setOrigin(0.5, 0).setDepth(110);
  }

  private handleAction(action: GameAction, fromComputer = false): void {
    if (this.matchOver) {
      return;
    }

    if (this.mode === "computer" && action.player === 2 && !fromComputer) {
      this.setActionMessage("COMPUTER CONTROLS PLAYER 2", "USE PLAYER 1 KEYS: F, B AND S");
      return;
    }

    this.players[action.player].swing(action.type);
    const result = this.ball.attemptAction(action, this.players[action.player].getCourtX());

    console.info("GameAction", action, result);
    this.showHitResult(action, result);

    const successful = result.outcome === "served"
      || result.outcome === "hit"
      || result.outcome === "awkward-hit";
    if (successful) {
      playBallHit(this);
      if (result.outcome === "served") {
        this.rallyCount = 0;
      } else {
        this.rallyCount += 1;
        this.updateRallyMeter();
      }
      if (action.power >= 0.9) {
        this.cameras.main.shake(125, 0.0048);
        this.stadium.reactCrowd(0.55);
      }
      this.positionPlayersForIncomingShot();
      if (this.ball.getReceiver() === 2) {
        this.computerHasActed = false;
      }
    }
  }

  private showHitResult(action: GameAction, result: HitResult): void {
    this.actionResetTimer?.remove(false);
    const playerName = this.displayName(action.player);

    switch (result.outcome) {
      case "served":
        this.setActionMessage(`${playerName} SERVE!`, this.shotDetail(action));
        break;
      case "hit":
        this.setActionMessage(`${playerName} ${action.type.toUpperCase()}!`, `CLEAN RETURN  •  ${this.shotDetail(action)}`);
        break;
      case "awkward-hit":
        this.setActionMessage(
          `${playerName} STRETCH ${action.type.toUpperCase()}!`,
          `REDUCED POWER  •  TRY ${result.recommendedShot?.toUpperCase()}`,
        );
        break;
      case "early":
        this.setActionMessage(`${playerName} EARLY!`, "WAIT UNTIL THE BALL REACHES THE RACKET");
        break;
      case "wrong-shot":
        this.setActionMessage(`${playerName} NO SERVE NOW`, `USE ${result.recommendedShot?.toUpperCase()}`);
        break;
      case "serve-required":
        this.setActionMessage(`${playerName} SERVE REQUIRED`, this.serveKeyPrompt());
        break;
      case "wrong-player":
        this.setActionMessage(`${playerName} WAIT!`, `${this.displayName(this.ball.getReceiver())} IS RECEIVING`);
        break;
      case "late":
        this.setActionMessage(`${playerName} LATE!`, "THE POINT IS RESETTING");
        break;
    }

    if (![
      "served",
      "hit",
      "awkward-hit",
      "late",
    ].includes(result.outcome)) {
      this.actionResetTimer = this.time.delayedCall(900, () => this.showReadyPrompt());
    }
  }

  private updateComputerOpponent(): void {
    if (
      this.mode !== "computer"
      || this.matchOver
      || this.computerHasActed
      || !this.ball.isReadyForReturn(2)
    ) {
      return;
    }

    this.computerHasActed = true;
    this.computerReturnCount += 1;

    if (this.computerReturnCount % 6 === 0) {
      this.setActionMessage("COMPUTER IS STRETCHED!", "CAN IT REACH THE BALL?");
      return;
    }

    const shotType = this.ball.getRecommendedShot(this.players[2].getCourtX());
    const directions = [-0.62, 0.38, 0, 0.66, -0.28] as const;
    const powers = [0.62, 0.72, 0.82, 0.68] as const;
    const action: GameAction = {
      player: 2,
      type: shotType,
      direction: directions[this.computerReturnCount % directions.length],
      power: powers[this.computerReturnCount % powers.length],
      timestamp: performance.now(),
    };

    this.handleAction(action, true);
  }

  private positionPlayersForIncomingShot(): void {
    const receiver = this.ball.getReceiver();
    const hitter: PlayerId = receiver === 1 ? 2 : 1;
    const targetX = this.ball.getTargetCourtX();
    const stanceOffset = targetX >= 0 ? -INTERCEPT_OFFSET : INTERCEPT_OFFSET;

    this.players[receiver].moveToCourtX(targetX + stanceOffset);
    this.players[hitter].moveToCourtX(0);
  }

  private handleMiss(missedPlayer: PlayerId): void {
    if (this.matchOver) {
      return;
    }

    const pointWinner: PlayerId = missedPlayer === 1 ? 2 : 1;
    playOut(this);
    const matchWinner = this.score.awardPoint(pointWinner);
    this.updateScoreboard(pointWinner);
    this.announcer.announce(this.score.getCallout(this.opponentVoice()));
    this.actionResetTimer?.remove(false);
    this.cameras.main.flash(130, 245, 238, 196, false);
    this.players[missedPlayer].reactToMiss();
    this.players[pointWinner].celebrate();
    this.stadium.reactCrowd(1.15);
    this.stadium.signalPoint();
    this.showPointBanner(pointWinner);
    this.rallyCount = 0;
    this.updateRallyMeter();

    if (matchWinner) {
      this.finishMatch(matchWinner);
      return;
    }

    this.setActionMessage(`${this.displayName(pointWinner)} WINS THE POINT!`, this.scoreLine());

    this.server = this.server === 1 ? 2 : 1;
    this.restartTimer?.remove(false);
    this.restartTimer = this.time.delayedCall(1_250, () => this.beginNextPoint());
  }

  private beginNextPoint(): void {
    this.players[1].moveToCourtX(0);
    this.players[2].moveToCourtX(0);
    this.ball.resetForServe(this.server);
    this.computerHasActed = false;
    this.showServePrompt();

    if (this.mode === "computer" && this.server === 2) {
      this.restartTimer = this.time.delayedCall(700, () => {
        const action: GameAction = {
          player: 2,
          type: "serve",
          power: 0.74,
          direction: this.computerReturnCount % 2 === 0 ? -0.35 : 0.35,
          timestamp: performance.now(),
        };
        this.handleAction(action, true);
      });
    }
  }

  private updateScoreboard(pointWinner: PlayerId): void {
    this.scoreTexts[1].setText(this.score.getDisplay(1));
    this.scoreTexts[2].setText(this.score.getDisplay(2));
    this.scoreStatusText.setText(this.score.getStatusLabel(this.opponentLabel()));
    const scoreText = this.scoreTexts[pointWinner];
    this.tweens.add({
      targets: scoreText,
      scale: 1.45,
      duration: 140,
      yoyo: true,
      ease: "Back.easeOut",
    });
  }

  private finishMatch(winner: PlayerId): void {
    this.matchOver = true;
    this.ball.stop();
    playWon(this);
    this.stadium.reactCrowd(1.6);
    this.players[winner].celebrate();
    this.showWinnerConfetti();
    this.setActionMessage(`${this.displayName(winner)} WINS!`, `FINAL SCORE  •  ${this.scoreLine()}`);

    this.add.rectangle(640, 420, 620, 206, 0x071f18, 0.95)
      .setStrokeStyle(4, 0xd9bd68, 1)
      .setDepth(180);
    this.add.text(640, 360, `${this.displayName(winner)} WINS`, {
      fontFamily: FONT_STACK,
      fontSize: "32px",
      fontStyle: "bold",
      color: "#dfff3f",
      stroke: "#173722",
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(190);
    this.add.text(640, 402, this.scoreLine(), {
      fontFamily: FONT_STACK,
      fontSize: "18px",
      fontStyle: "bold",
      color: "#f3e9ca",
    }).setOrigin(0.5).setDepth(190);

    createUiButton(this, 505, 468, 210, 58, "REMATCH", () => {
      this.scene.restart({ mode: this.mode });
    });
    createUiButton(this, 775, 468, 210, 58, "MAIN MENU", () => {
      this.scene.start("MenuScene");
    });
  }

  private showReadyPrompt(): void {
    const receiver = this.ball.getReceiver();
    this.setActionMessage(`${this.displayName(receiver)} GET READY`, "CHOOSE A STROKE AS THE BALL REACHES YOU");
  }

  private showServePrompt(): void {
    this.setActionMessage(`${this.displayName(this.server)} TO SERVE`, this.serveKeyPrompt());
  }

  private serveKeyPrompt(): string {
    if (this.mode === "computer" && this.server === 2) {
      return "COMPUTER SERVING...";
    }
    return this.server === 1 ? "PRESS S" : "PRESS ↑";
  }

  private displayName(player: PlayerId): string {
    if (player === 2 && this.mode === "computer") {
      return "COMPUTER";
    }
    return `P${player}`;
  }

  private scoreLine(): string {
    return `P1 ${this.score.getDisplay(1)}  —  ${this.opponentLabel()} ${this.score.getDisplay(2)}`;
  }

  private opponentLabel(): "CPU" | "P2" {
    return this.mode === "computer" ? "CPU" : "P2";
  }

  private opponentVoice(): TennisOpponent {
    return this.mode === "computer" ? "computer" : "player-two";
  }

  private shotDetail(action: GameAction): string {
    const power = Math.round(action.power * 100);
    const direction = action.direction < 0 ? "LEFT" : action.direction > 0 ? "RIGHT" : "CENTRE";
    return `${power}% POWER  •  ${direction}`;
  }

  private setActionMessage(title: string, detail: string): void {
    this.actionText.setText(title);
    this.actionDetailText.setText(detail);
    this.actionText.setScale(0.94);
    this.tweens.add({
      targets: this.actionText,
      scale: 1,
      duration: 130,
      ease: "Back.easeOut",
    });
  }

  private updateRallyMeter(): void {
    this.rallyText.setText(`RALLY  ${this.rallyCount}`);
    this.rallyText.setColor(this.rallyCount >= 5 ? "#dfff3f" : "#7fa38b");

    if (![3, 5, 8, 12].includes(this.rallyCount)) {
      return;
    }

    const callout = this.add.text(640, 212, `${this.rallyCount} SHOT RALLY!`, {
      fontFamily: FONT_STACK,
      fontSize: this.rallyCount >= 8 ? "27px" : "21px",
      fontStyle: "bold",
      color: "#dfff3f",
      stroke: "#173722",
      strokeThickness: 7,
    }).setOrigin(0.5).setDepth(140).setScale(0.7);
    this.stadium.reactCrowd(0.75);
    this.tweens.add({
      targets: callout,
      y: callout.y - 35,
      scale: 1.15,
      alpha: 0,
      duration: 760,
      ease: "Back.easeOut",
      onComplete: () => callout.destroy(),
    });
  }

  private showPointBanner(pointWinner: PlayerId): void {
    const panel = this.add.rectangle(0, 0, 390, 74, 0x071f18, 0.94)
      .setStrokeStyle(4, 0xd9bd68, 1);
    const label = this.add.text(0, 0, `POINT  ${this.displayName(pointWinner)}`, {
      fontFamily: FONT_STACK,
      fontSize: "25px",
      fontStyle: "bold",
      color: "#f3e9ca",
      letterSpacing: 2,
    }).setOrigin(0.5);
    const banner = this.add.container(-240, 270, [panel, label]).setDepth(155);

    this.tweens.add({
      targets: banner,
      x: 640,
      duration: 210,
      ease: "Back.easeOut",
      onComplete: () => {
        this.time.delayedCall(520, () => {
          this.tweens.add({
            targets: banner,
            x: 1_520,
            alpha: 0,
            duration: 230,
            ease: "Quad.easeIn",
            onComplete: () => banner.destroy(),
          });
        });
      },
    });
  }

  private showWinnerConfetti(): void {
    const colors = [0xdfff3f, 0xf3e9ca, 0xd9bd68, 0x9f2633, 0x33577b] as const;
    for (let index = 0; index < 42; index += 1) {
      const x = 250 + ((index * 97) % 780);
      const confetti = this.add.rectangle(x, 190 - (index % 6) * 16, 7, 13, colors[index % colors.length], 1)
        .setAngle((index * 37) % 180)
        .setDepth(210);
      this.tweens.add({
        targets: confetti,
        x: confetti.x + ((index % 7) - 3) * 24,
        y: 660 + (index % 4) * 18,
        angle: confetti.angle + 300 + (index % 5) * 70,
        alpha: 0,
        duration: 1_300 + (index % 8) * 90,
        delay: (index % 9) * 35,
        ease: "Quad.easeIn",
        onComplete: () => confetti.destroy(),
      });
    }
  }
}
