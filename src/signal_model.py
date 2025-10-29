from typing import List, Tuple

from constants import INITIAL_REACTION_WINDOW, ADAPTIVE_WINDOW_CHECK, \
    SUCCESS_THRESHOLD, MIN_REACTION_WINDOW, WINDOW_DECREASE_FACTOR, EXIT_KEY, ENTRY_KEY


class SignalModel:
    """Gère la génération des signaux ENTRY/EXIT et mesure des réactions."""
    def __init__(self) -> None:
        self.reaction_window = INITIAL_REACTION_WINDOW
        self.current_signal: str | None = None
        self.signal_timestamp: float | None = None
        self.results: List[Tuple[float, bool]] = []

    def trigger(self, signal: str, now: float) -> None:
        self.current_signal = signal
        self.signal_timestamp = now

    def record_reaction(self, key: int, now: float) -> bool:
        if self.current_signal is None:
            return False
        rt = now - (self.signal_timestamp or now)
        ok = False
        if ((self.current_signal=="ENTRY" and key==ENTRY_KEY) or
            (self.current_signal=="EXIT" and key==EXIT_KEY)) and rt<=self.reaction_window:
            ok = True
        self.results.append((rt, ok))
        self.current_signal = None
        self._adapt()
        return ok

    def _adapt(self) -> None:
        if len(self.results) < ADAPTIVE_WINDOW_CHECK:
            return
        window = self.results[-ADAPTIVE_WINDOW_CHECK:]
        rate = sum(1 for _, ok in window if ok)/ADAPTIVE_WINDOW_CHECK
        if rate >= SUCCESS_THRESHOLD:
            self.reaction_window = max(
                MIN_REACTION_WINDOW,
                self.reaction_window*WINDOW_DECREASE_FACTOR
            )