import type { ScoreCallout } from "../game/Score";

export class ScoreAnnouncer {
  public announce(callout: ScoreCallout): void {
    console.info(`Score callout: ${callout.key}`);
    this.speak(callout.text);
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
