// SignalModel.ts - Converted from signal_model.py

import {
  INITIAL_REACTION_WINDOW,
  ADAPTIVE_WINDOW_CHECK,
  SUCCESS_THRESHOLD,
  MIN_REACTION_WINDOW,
  WINDOW_DECREASE_FACTOR,
  ENTRY_KEY,
  EXIT_KEY,
} from "../constants";

export type SignalType = "ENTRY" | "EXIT" | null;

export class SignalModel {
  public reactionWindow: number;
  public currentSignal: SignalType;
  public signalTimestamp: number | null;
  private results: Array<[number, boolean]>;

  constructor() {
    this.reactionWindow = INITIAL_REACTION_WINDOW;
    this.currentSignal = null;
    this.signalTimestamp = null;
    this.results = [];
  }

  trigger(signal: "ENTRY" | "EXIT", now: number): void {
    this.currentSignal = signal;
    this.signalTimestamp = now;
  }

  recordReaction(key: string, now: number): boolean {
    if (this.currentSignal === null || this.signalTimestamp === null) {
      return false;
    }

    const rt = now - this.signalTimestamp;
    let ok = false;

    if (
      ((this.currentSignal === "ENTRY" && key === ENTRY_KEY) ||
        (this.currentSignal === "EXIT" && key === EXIT_KEY)) &&
      rt <= this.reactionWindow
    ) {
      ok = true;
    }

    this.results.push([rt, ok]);
    this.currentSignal = null;
    this.adapt();
    return ok;
  }

  private adapt(): void {
    if (this.results.length < ADAPTIVE_WINDOW_CHECK) {
      return;
    }

    const window = this.results.slice(-ADAPTIVE_WINDOW_CHECK);
    const successCount = window.filter(([_, ok]) => ok).length;
    const rate = successCount / ADAPTIVE_WINDOW_CHECK;

    if (rate >= SUCCESS_THRESHOLD) {
      this.reactionWindow = Math.max(
        MIN_REACTION_WINDOW,
        this.reactionWindow * WINDOW_DECREASE_FACTOR
      );
    }
  }

  getResults(): Array<[number, boolean]> {
    return [...this.results];
  }
}
