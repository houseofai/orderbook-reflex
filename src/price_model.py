import datetime
import pickle
from typing import Dict, List
from collections import deque
from exchangebookgenerator import ExchangeBookGenerator
from modelisation.simulate_quotes import QuoteGenerator

DEFAULT_SHARES = ExchangeBookGenerator.DEFAULT_SHARES.copy()
DEFAULT_OFFSETS = ExchangeBookGenerator.DEFAULT_OFFSETS.copy()

class PriceModel:
    """Génère et met à jour les prix du carnet tout en détectant les pivots
    au moyen d’un buffer rétrospectif de 2*window+1 secondes."""

    def __init__(
        self,
        model_path: str = "../models/model-20251029-100049.pkl",
        tick_size: float = 0.01,
        spread: float = 0.02,
        window_seconds: int = 30,
    ) -> None:
        # --- modèle de génération des ticks -----------------------------------
        with open(model_path, "rb") as f:
            quote_model = pickle.load(f)

        base_bid = 100.00
        base_ask = base_bid + spread

        self.generator = QuoteGenerator(quote_model, base_bid, base_ask)
        self.exchange_gen = ExchangeBookGenerator(
            shares=DEFAULT_SHARES,
            offsets_p=DEFAULT_OFFSETS,
            seed=42,
        )
        self.last_exchange_quotes: List[Dict] = []

        # --- paramètres --------------------------------------------------------
        self.tick_size = tick_size
        self.spread = spread
        self.window = window_seconds

        # --- buffer rétrospectif : longueur = 2*window + 1 --------------------
        self.buffer: deque[Dict[str, float]] = deque(
            maxlen=2 * window_seconds + 1
        )
        for _ in range(self.buffer.maxlen):
            self.buffer.append(
                {"bid": base_bid, "ask": base_ask, "mid": (base_bid + base_ask) / 2}
            )

        # --- état pivot & best bid/ask ----------------------------------------
        self.pivot: str | None = None          # "PL", "PH" ou None
        self.pivot_bid = base_bid
        self.pivot_ask = base_ask
        self.best_bid = base_bid
        self.best_ask = base_ask

    # -------------------------------------------------------------------------
    def update(self) -> None:
        """Ajoute le tick courant, met à jour le buffer et détecte
        un éventuel pivot situé window s dans le passé."""
        now_dt = datetime.datetime.now(datetime.timezone.utc)

        # 1) Génération du tick à l’instant présent (plus de look-ahead)
        ticks = self.generator.step_second(now_dt, ("N", "O"), "F")
        if ticks:                                  # un vrai tick a été produit
            last = ticks[-1]
            self.last_exchange_quotes = self.exchange_gen.generate(last)
            bid = last["priceBid"]
            ask = last["priceAsk"]
            mid = (bid + ask) / 2
            self.best_bid, self.best_ask = bid, ask
        else:                                      # aucune variation → reprise du dernier prix
            last_entry = self.buffer[-1]
            bid, ask, mid = (
                last_entry["bid"],
                last_entry["ask"],
                last_entry["mid"],
            )

        # 2) Mise à jour du buffer (append à droite, pop automatique à gauche)
        self.buffer.append({"bid": bid, "ask": ask, "mid": mid})

        # 3) Détection du pivot sur l’élément situé window s dans le passé
        if len(self.buffer) == self.buffer.maxlen:
            centre = self.buffer[self.window]
            mids = [e["mid"] for e in self.buffer]

            if centre["mid"] == max(mids):
                self.pivot = "PH"                 # pivot high
            elif centre["mid"] == min(mids):
                self.pivot = "PL"                 # pivot low
            else:
                self.pivot = None

            self.pivot_bid = centre["bid"]
            self.pivot_ask = centre["ask"]