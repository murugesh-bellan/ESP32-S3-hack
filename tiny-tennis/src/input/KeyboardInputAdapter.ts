import type { GameAction, PlayerId, ShotType } from "./GameAction";
import type { GameActionHandler, InputAdapter } from "./InputAdapter";

const SOFT_POWER = 0.42;
const DEFAULT_POWER = 0.7;
const HARD_POWER = 0.95;
const AIM_AMOUNT = 0.75;

interface ShotBinding {
  player: PlayerId;
  type: ShotType;
}

export interface KeyboardBindings {
  shots: Readonly<Record<string, ShotBinding>>;
  playerOneAimLeft: string;
  playerOneAimRight: string;
  playerTwoAimLeft: string;
  playerTwoAimRight: string;
  softPower: string;
}

export const DEFAULT_KEYBOARD_BINDINGS: KeyboardBindings = {
  shots: {
    KeyF: { player: 1, type: "forehand" },
    KeyB: { player: 1, type: "backhand" },
    KeyS: { player: 1, type: "serve" },
    ArrowLeft: { player: 2, type: "backhand" },
    ArrowRight: { player: 2, type: "forehand" },
    ArrowUp: { player: 2, type: "serve" },
  },
  playerOneAimLeft: "KeyA",
  playerOneAimRight: "KeyD",
  playerTwoAimLeft: "KeyJ",
  playerTwoAimRight: "KeyL",
  softPower: "Space",
};

export class KeyboardInputAdapter implements InputAdapter {
  private onAction?: GameActionHandler;
  private playerOneAimLeftPressed = false;
  private playerOneAimRightPressed = false;
  private playerTwoAimLeftPressed = false;
  private playerTwoAimRightPressed = false;
  private softPowerPressed = false;

  public constructor(
    private readonly bindings: KeyboardBindings = DEFAULT_KEYBOARD_BINDINGS,
  ) {}

  public start(onAction: GameActionHandler): void {
    this.stop();
    this.onAction = onAction;
    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    window.addEventListener("blur", this.handleBlur);
  }

  public stop(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.handleBlur);
    this.onAction = undefined;
    this.clearHeldControls();
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (event.code === this.bindings.playerOneAimLeft) {
      this.playerOneAimLeftPressed = true;
      event.preventDefault();
      return;
    }

    if (event.code === this.bindings.playerOneAimRight) {
      this.playerOneAimRightPressed = true;
      event.preventDefault();
      return;
    }

    if (event.code === this.bindings.playerTwoAimLeft) {
      this.playerTwoAimLeftPressed = true;
      event.preventDefault();
      return;
    }

    if (event.code === this.bindings.playerTwoAimRight) {
      this.playerTwoAimRightPressed = true;
      event.preventDefault();
      return;
    }

    if (event.code === this.bindings.softPower) {
      this.softPowerPressed = true;
      event.preventDefault();
      return;
    }

    const binding = this.bindings.shots[event.code];
    if (!binding) {
      return;
    }

    event.preventDefault();
    if (event.repeat) {
      return;
    }

    const action: GameAction = {
      player: binding.player,
      type: binding.type,
      power: this.powerFor(event),
      direction: this.directionFor(binding.player),
      timestamp: performance.now(),
    };

    this.onAction?.(action);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (event.code === this.bindings.playerOneAimLeft) {
      this.playerOneAimLeftPressed = false;
      event.preventDefault();
    }

    if (event.code === this.bindings.playerOneAimRight) {
      this.playerOneAimRightPressed = false;
      event.preventDefault();
    }

    if (event.code === this.bindings.playerTwoAimLeft) {
      this.playerTwoAimLeftPressed = false;
      event.preventDefault();
    }

    if (event.code === this.bindings.playerTwoAimRight) {
      this.playerTwoAimRightPressed = false;
      event.preventDefault();
    }

    if (event.code === this.bindings.softPower) {
      this.softPowerPressed = false;
      event.preventDefault();
    }
  };

  private readonly handleBlur = (): void => {
    this.clearHeldControls();
  };

  private directionFor(player: PlayerId): number {
    const leftPressed = player === 1
      ? this.playerOneAimLeftPressed
      : this.playerTwoAimLeftPressed;
    const rightPressed = player === 1
      ? this.playerOneAimRightPressed
      : this.playerTwoAimRightPressed;

    if (leftPressed === rightPressed) {
      return 0;
    }

    return leftPressed ? -AIM_AMOUNT : AIM_AMOUNT;
  }

  private powerFor(event: KeyboardEvent): number {
    if (event.shiftKey) {
      return HARD_POWER;
    }

    return this.softPowerPressed ? SOFT_POWER : DEFAULT_POWER;
  }

  private clearHeldControls(): void {
    this.playerOneAimLeftPressed = false;
    this.playerOneAimRightPressed = false;
    this.playerTwoAimLeftPressed = false;
    this.playerTwoAimRightPressed = false;
    this.softPowerPressed = false;
  }
}
