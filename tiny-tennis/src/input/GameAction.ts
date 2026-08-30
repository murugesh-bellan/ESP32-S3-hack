export type PlayerId = 1 | 2;

export type ShotType = "forehand" | "backhand" | "serve";

export interface GameAction {
  player: PlayerId;
  type: ShotType;
  power: number;
  direction: number;
  confidence?: number;
  timestamp: number;
}
