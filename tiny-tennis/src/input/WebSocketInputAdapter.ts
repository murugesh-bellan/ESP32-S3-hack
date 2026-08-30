import type { GameAction, PlayerId, ShotType } from "./GameAction";
import type { GameActionHandler, InputAdapter } from "./InputAdapter";

export interface WebSocketInputAdapterOptions {
  room: string;
  url?: string;
  token?: string;
  onStatus?: (status: "connecting" | "connected" | "offline") => void;
  onShot?: (action: GameAction) => void;
}

interface ShotMessage {
  type: "shot";
  player: PlayerId;
  gesture: ShotType;
  power: number;
  probability?: number;
  confidence?: number;
  timestamp?: number;
}

export class WebSocketInputAdapter implements InputAdapter {
  private socket?: WebSocket;
  private onAction?: GameActionHandler;

  public constructor(private readonly options: WebSocketInputAdapterOptions) {}

  public start(onAction: GameActionHandler): void {
    this.stop();
    this.onAction = onAction;
    const url = this.options.url ?? this.defaultUrl();
    this.options.onStatus?.("connecting");
    this.socket = new WebSocket(url);
    this.socket.addEventListener("open", () => this.options.onStatus?.("connected"));
    this.socket.addEventListener("open", this.handleOpen);
    this.socket.addEventListener("message", this.handleMessage);
    this.socket.addEventListener("error", () => {
      this.options.onStatus?.("offline");
      console.warn("Tiny Tennis WebSocket unavailable", url);
    });
    this.socket.addEventListener("close", () => this.options.onStatus?.("offline"));
  }

  public stop(): void {
    if (this.socket) {
      this.socket.removeEventListener("open", this.handleOpen);
      this.socket.removeEventListener("message", this.handleMessage);
      this.socket.close();
    }
    this.socket = undefined;
    this.onAction = undefined;
  }

  private readonly handleOpen = (): void => {
    this.socket?.send(JSON.stringify({
      type: "join",
      role: "browser",
      room: this.options.room,
      token: this.options.token,
    }));
    console.info(`Tiny Tennis controller room connected: ${this.options.room}`);
  };

  private readonly handleMessage = (event: MessageEvent<string>): void => {
    let message: unknown;
    try {
      message = JSON.parse(event.data);
    } catch {
      console.warn("Tiny Tennis WS: non-JSON message", event.data);
      return;
    }

    if (!this.isShotMessage(message)) {
      // Not acted on as gameplay, but still worth seeing - e.g. "joined",
      // "participant-joined", "error", or a gesture that failed validation.
      console.debug("Tiny Tennis WS recv (not a shot)", message);
      return;
    }

    const confidence = message.confidence ?? message.probability;
    const action: GameAction = {
      player: message.player,
      type: message.gesture,
      power: clamp(message.power, 0, 1),
      direction: 0,
      confidence: confidence === undefined ? undefined : clamp(confidence, 0, 1),
      timestamp: message.timestamp ?? performance.now(),
    };
    console.info("Tiny Tennis WS shot ->", action);
    this.onAction?.(action);
    this.options.onShot?.(action);
  };

  private isShotMessage(message: unknown): message is ShotMessage {
    if (!message || typeof message !== "object") {
      return false;
    }
    const candidate = message as Partial<ShotMessage>;
    return candidate.type === "shot"
      && (candidate.player === 1 || candidate.player === 2)
      && (candidate.gesture === "forehand" || candidate.gesture === "backhand" || candidate.gesture === "serve")
      && typeof candidate.power === "number"
      && Number.isFinite(candidate.power);
  }

  private defaultUrl(): string {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/ws`;
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
