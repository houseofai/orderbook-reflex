import numpy as np
from typing import List, Dict

class ExchangeBookGenerator:
    """Génère un carnet Level‑1 multi‑exchange cohérent avec un NBBO donné.

    Correctifs 2025‑06‑23
    --------------------
    • **Aucun volume nul ou négatif** : on limite le nombre d’exchanges actifs à ce
      que chaque venue reçoive **au moins 100 actions** (lot minimal affiché).
    • **NBBO toujours doté d’un volume ≥100**.
    • Table d’exchanges par défaut mise à jour (plus de « Other »).
    """

    TICK = 0.01  # mouvement de prix minimal (1 ¢)

    # ──────────────────────────────────────────────
    #  PARAMÈTRES PAR DÉFAUT (modifiable côté PriceModel)
    # ──────────────────────────────────────────────
    DEFAULT_SHARES: Dict[str, float] = {
        "NSDQ": 0.30,
        "ARCA": 0.18,
        "BATS": 0.10,
        "BATY": 0.06,
        "EDGA": 0.03,
        "EDGX": 0.07,
        "IEXG": 0.05,
        "AMEX": 0.03,
        "NYSE": 0.12,
        "PHLX": 0.01,
        "MEMX": 0.03,
        "MIAX": 0.01,
        "BOSX": 0.00,   # volumes marginaux, gardé pour la variété
        "LTSE": 0.01,
    }

    DEFAULT_OFFSETS: Dict[int, float] = {0: 0.35, 1: 0.30, -1: 0.20, 2: 0.10, -2: 0.05}

    def __init__(self,
                 shares: Dict[str, float] | None = None,
                 offsets_p: Dict[int, float] | None = None,
                 seed: int | None = None):
        # Part de marché par venue ➔ transforme en distribution
        self.shares = shares or self.DEFAULT_SHARES.copy()
        total_share = sum(self.shares.values())
        if total_share == 0:
            raise ValueError("Sum of market shares must be > 0")
        self.exchs   = np.array(list(self.shares.keys()))
        self.share_p = np.array(list(self.shares.values()), dtype=float) / total_share

        # Distribution d’offsets (en ticks)
        self.offsets_p = offsets_p or self.DEFAULT_OFFSETS.copy()
        self.kvals  = np.array(list(self.offsets_p.keys()), dtype=int)
        probs       = np.array(list(self.offsets_p.values()), dtype=float)
        self.offset_p = probs / probs.sum()

        self.rng = np.random.default_rng(seed)

    # ──────────────────────────────────────────────
    #  MÉTHODES INTERNES
    # ──────────────────────────────────────────────
    def _pick_exchanges(self, total_size: int) -> np.ndarray:
        """Sélectionne un nombre de venues compatible avec le volume total.

        • Minimum 3 venues.
        • Maximum : min(7, total_size // 100).  Chaque venue aura ≥100 shares.
        """
        max_n = min(7, max(1, total_size // 100))
        n = self.rng.integers(3, max_n + 1) if max_n >= 3 else 1
        return self.rng.choice(self.exchs, size=n, replace=False, p=self.share_p)

    def _dirichlet_sizes(self, total: int, n: int) -> np.ndarray:
        """Répartition de `total` en n blocs ≥100.

        Algorithme :
        1. Tire un Dirichlet `w`.
        2. Transforme en lots de 100 actions via floor.
        3. Répartit le reste (total - somme)  par incréments de 100 jusqu’à épuisement.
        """
        if n == 1:
            return np.array([total], dtype=int)

        # Étape 1‑2
        w = self.rng.dirichlet(np.ones(n))
        sizes = np.floor(w * total / 100).astype(int) * 100

        # Garantit un minimum de 100 pour chaque venue
        shortfall = (sizes == 0).sum() * 100
        sizes[sizes == 0] = 100

        # Ajuste le surplus/déficit par rapport à total
        diff = total - sizes.sum()

        # Cas surplus : retire 100 sur les plus grosses tailles
        while diff < 0:
            idx = sizes.argmax()
            if sizes[idx] > 100:
                sizes[idx] -= 100
                diff += 100
            else:
                break  # sécurité

        # Cas déficit : ajoute 100 aux venues au hasard
        while diff > 0:
            idx = self.rng.integers(n)
            sizes[idx] += 100
            diff -= 100

        return sizes

    def _draw_offsets(self, n: int, ensure_best: bool = False) -> np.ndarray:
        k = self.rng.choice(self.kvals, size=n, p=self.offset_p)
        if ensure_best and not np.any(k == 0):
            k[self.rng.integers(n)] = 0
        return k * self.TICK

    # ──────────────────────────────────────────────
    #  API PUBLIQUE
    # ──────────────────────────────────────────────
    def generate(self, tick: Dict) -> List[Dict]:
        """Produit les quotes par exchange pour un tick NBBO.

        `tick` doit contenir : `time`, `priceBid`, `priceAsk`, `sizeBid`, `sizeAsk`.
        """
        nbbo_bid, nbbo_ask = tick["priceBid"], tick["priceAsk"]
        size_bid, size_ask = tick["sizeBid"], tick["sizeAsk"]

        exchs = self._pick_exchanges(total_size=min(size_bid, size_ask))
        n     = len(exchs)

        bid_sizes = self._dirichlet_sizes(size_bid, n)
        ask_sizes = self._dirichlet_sizes(size_ask, n)

        bid_off   = self._draw_offsets(n, ensure_best=True)
        ask_off   = self._draw_offsets(n, ensure_best=True)

        # Garantit un volume sur la(les) ligne(s) NBBO
        nbbo_bid_idx = np.where(bid_off == 0)[0]
        if bid_sizes[nbbo_bid_idx].min() < 100:
            deficit = 100 - bid_sizes[nbbo_bid_idx].min()
            donor = bid_sizes.argmax()
            if bid_sizes[donor] - deficit >= 100:
                bid_sizes[donor] -= deficit
                bid_sizes[nbbo_bid_idx[0]] += deficit

        nbbo_ask_idx = np.where(ask_off == 0)[0]
        if ask_sizes[nbbo_ask_idx].min() < 100:
            deficit = 100 - ask_sizes[nbbo_ask_idx].min()
            donor = ask_sizes.argmax()
            if ask_sizes[donor] - deficit >= 100:
                ask_sizes[donor] -= deficit
                ask_sizes[nbbo_ask_idx[0]] += deficit

        # Construction finale
        quotes: List[Dict] = []
        for i, ex in enumerate(exchs):
            quotes.append({
                "time":     tick["time"],
                "exchange": ex,
                "priceBid": round(nbbo_bid + bid_off[i], 2),
                "sizeBid":  int(bid_sizes[i]),
                "priceAsk": round(nbbo_ask + ask_off[i], 2),
                "sizeAsk":  int(ask_sizes[i]),
            })
        return quotes
