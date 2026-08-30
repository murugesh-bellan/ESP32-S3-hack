import type { PlayerId } from "../input/GameAction";

export class ScoreAnnouncer {
  public constructor(private readonly playerTwoName: string) {}

  public announcePoint(
    pointWinner: PlayerId,
    playerOneScore: number,
    playerTwoScore: number,
  ): void {
    const winnerName = pointWinner === 1 ? "Player one" : this.playerTwoName;
    this.speak(`${winnerName} scores. ${playerOneScore} to ${playerTwoScore}.`);
  }

  public announceWinner(winner: PlayerId): void {
    const winnerName = winner === 1 ? "Player one" : this.playerTwoName;
    this.speak(`${winnerName} wins the match.`);
  }

  public stop(): void {
    window.speechSynthesis?.cancel();
  }

  private speak(message: string): void {
    if (!("speechSynthesis" in window)) {
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1.05;
    utterance.pitch = 0.9;
    utterance.volume = 0.85;
    window.speechSynthesis.speak(utterance);
  }
}
