import type { PlayerId } from "../input/GameAction";

export const POINTS_TO_WIN = 5;

export class Score {
  private readonly points: Record<PlayerId, number> = { 1: 0, 2: 0 };

  public awardPoint(player: PlayerId): PlayerId | undefined {
    this.points[player] += 1;
    return this.points[player] >= POINTS_TO_WIN ? player : undefined;
  }

  public get(player: PlayerId): number {
    return this.points[player];
  }

  public reset(): void {
    this.points[1] = 0;
    this.points[2] = 0;
  }
}
