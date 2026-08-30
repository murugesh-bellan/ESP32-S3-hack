import type { PlayerId } from "../input/GameAction";

export type TennisPointLabel = "LOVE" | "15" | "30" | "40";
export type TennisOpponent = "computer" | "player-two";

export interface ScoreCallout {
  key: string;
  text: string;
}

export type TennisScoreState =
  | { type: "score" }
  | { type: "deuce" }
  | { type: "advantage"; player: PlayerId }
  | { type: "game"; winner: PlayerId };

const POINT_LABELS: readonly TennisPointLabel[] = ["LOVE", "15", "30", "40"];

export class Score {
  private readonly points: Record<PlayerId, number> = { 1: 0, 2: 0 };
  private winner?: PlayerId;

  public awardPoint(player: PlayerId): PlayerId | undefined {
    if (this.winner) {
      return this.winner;
    }

    this.points[player] += 1;
    const opponent: PlayerId = player === 1 ? 2 : 1;
    if (this.points[player] >= 4 && this.points[player] - this.points[opponent] >= 2) {
      this.winner = player;
    }

    return this.winner;
  }

  public getDisplay(player: PlayerId): TennisPointLabel | "AD" | "GAME" {
    const state = this.getState();
    if (state.type === "game" && state.winner === player) {
      return "GAME";
    }

    if (state.type === "advantage" && state.player === player) {
      return "AD";
    }

    return this.pointLabel(this.points[player]);
  }

  public getState(): TennisScoreState {
    if (this.winner) {
      return { type: "game", winner: this.winner };
    }

    if (this.points[1] >= 3 && this.points[2] >= 3) {
      const difference = this.points[1] - this.points[2];
      if (difference === 0) {
        return { type: "deuce" };
      }
      return { type: "advantage", player: difference > 0 ? 1 : 2 };
    }

    return { type: "score" };
  }

  public getCallout(opponent: TennisOpponent): ScoreCallout {
    const state = this.getState();
    if (state.type === "deuce") {
      return { key: "score-deuce", text: "Deuce." };
    }

    if (state.type === "advantage") {
      const name = this.spokenPlayerName(state.player, opponent);
      return {
        key: state.player === 1 ? "advantage-player-one" : `advantage-${opponent}`,
        text: `Advantage, ${name}.`,
      };
    }

    if (state.type === "game") {
      const name = this.spokenPlayerName(state.winner, opponent);
      return {
        key: state.winner === 1 ? "game-player-one" : `game-${opponent}`,
        text: `Game, ${name}.`,
      };
    }

    const playerOneLabel = this.pointLabel(this.points[1]);
    const playerTwoLabel = this.pointLabel(this.points[2]);
    const playerOneSlug = this.labelSlug(playerOneLabel);
    const playerTwoSlug = this.labelSlug(playerTwoLabel);

    if (playerOneLabel === playerTwoLabel) {
      return {
        key: `score-${playerOneSlug}-all`,
        text: `${this.spokenPoint(playerOneLabel)} all.`,
      };
    }

    return {
      key: `score-${playerOneSlug}-${playerTwoSlug}`,
      text: `${this.spokenPoint(playerOneLabel)}, ${this.spokenPoint(playerTwoLabel)}.`,
    };
  }

  public getStatusLabel(opponentLabel: string): string {
    const state = this.getState();
    switch (state.type) {
      case "deuce":
        return "DEUCE";
      case "advantage":
        return `ADVANTAGE  ${state.player === 1 ? "PLAYER 1" : opponentLabel}`;
      case "game":
        return `GAME  ${state.winner === 1 ? "PLAYER 1" : opponentLabel}`;
      case "score":
        return this.getCallout("player-two").text.replace(".", "").toUpperCase();
    }
  }

  public reset(): void {
    this.points[1] = 0;
    this.points[2] = 0;
    this.winner = undefined;
  }

  private pointLabel(points: number): TennisPointLabel {
    return POINT_LABELS[Math.min(points, 3)];
  }

  private labelSlug(label: TennisPointLabel): string {
    return label === "LOVE" ? "love" : label;
  }

  private spokenPoint(label: TennisPointLabel): string {
    if (label === "LOVE") {
      return "Love";
    }
    if (label === "15") {
      return "Fifteen";
    }
    if (label === "30") {
      return "Thirty";
    }
    return "Forty";
  }

  private spokenPlayerName(player: PlayerId, opponent: TennisOpponent): string {
    if (player === 1) {
      return "Player one";
    }
    return opponent === "computer" ? "Computer" : "Player two";
  }
}
