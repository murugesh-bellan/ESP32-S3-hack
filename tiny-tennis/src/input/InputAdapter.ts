import type { GameAction } from "./GameAction";

export type GameActionHandler = (action: GameAction) => void;

export interface InputAdapter {
  start(onAction: GameActionHandler): void;
  stop(): void;
}
