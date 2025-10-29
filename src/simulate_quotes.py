"""simulate_quotes.py
====================
Synthetic generation of best‑bid / best‑ask **quotes** for a single US equity.

The goal is to feed a *reflex‑training* order‑book simulator with price action
that **looks and feels realistic** while staying extremely light‑weight.
The module therefore implements a *very small* non‑parametric model that can
be learned online from real quotes and later sampled to produce artificial
streams.

---------------------------------------------------------------------
1.  Regime Space
---------------------------------------------------------------------
The market micro‑structure is approximated by two orthogonal binary *regimes*:

* **Momentum (`M` vs `N`)** – Is the price currently *trending*?
  We compute an Exponential Weighted Moving Average (EWMA) of `|Δp|` and
  consider that we are in momentum if it exceeds **1 ¢**.
* **Break‑out (`B` vs `O`)** – Is the *mid‑price* sitting *close* (±1 ¢)
  to a round dollar or a half‑dollar level?  Empirically those levels act as
  magnets and generate specific order‑flow patterns.

These two booleans yield **four market regimes**:

=================  ======  ======
`(Momentum, BO)`   Label   Meaning
=================  ======  ======
`(M, B)`           MB      trending **and** close to integer / half‑dollar
`(M, O)`           MO      trending but away from psychological levels
`(N, B)`           NB      flat but close to a level (potential breakout)
`(N, O)`           NO      boring / normal conditions (default)
=================  ======  ======

---------------------------------------------------------------------
2.  Tick Sign (`U`, `D`, `F`)
---------------------------------------------------------------------
Inside a single second we *bin* every update according to the **sign** of the
last price change:

* **`U`** – up‑tick  (Δp > 0)
* **`D`** – down‑tick (Δp < 0)
* **`F`** – flat      (Δp = 0)

`(regime, sign)` therefore indexes a **6‑dimensional table** holding the joint
frequency of the following *binned* micro‑features: `(Δp, spread, size)`.

---------------------------------------------------------------------
3.  Main Public Classes
---------------------------------------------------------------------
* :class:`FeatureBuilder` – stateless helper converting a raw quote row to the
  small feature dict consumed by the learner.
* :class:`QuoteModel` – incremental learner that stores (i) the per‑regime
  tick *intensity* λ    and (ii) the multinomial distribution over discretised
  `(Δp_bin, spread_bin, size_bin)`.
* :class:`QuoteGenerator` – small wrapper that turns a learned
  :class:`QuoteModel` into a generator of perfectly formatted synthetic ticks
  for the simulator.

All monetary numbers are in **USD** and every quote is rounded to the nearest
`$0.01` before being returned.
"""

from collections import Counter, defaultdict
import numpy as np
import random

# ------------------------------------------------------------
# 1.  FeatureBuilder – extract tiny set of micro‑features
# ------------------------------------------------------------

class FeatureBuilder:
    """Light‑weight online feature extractor.

    Parameters
    ----------
    alpha : float, default ``0.9``
        Smoothing factor for the EWMA used to detect momentum.  A lower value
        reacts faster but is more noisy.
    """

    def __init__(self, alpha: float = 0.9):
        self.prev_mid: float | None = None   # mid‑price of previous tick
        self.ewma_abs_dp: float = 0.0        # EWMA of |Δp|
        self.alpha = alpha                   # EWMA smoothing coefficient

    # ------------------------------------------------------------------
    # Public API – single‑tick transform
    # ------------------------------------------------------------------
    def transform(self, row):
        """Convert one quote *row* to a dict of discrete / boolean features.

        The function is *stateful* because momentum requires the previous
        mid‑price.  It therefore **must** be called sequentially.
        """
        mid = (row.priceBid + row.priceAsk) / 2
        spread = row.priceAsk - row.priceBid

        # ----------------------------------------------------------------
        # Δp – signed change of mid‑price since previous tick
        # ----------------------------------------------------------------
        dp = 0.0 if self.prev_mid is None else mid - self.prev_mid
        self.prev_mid = mid

        # ----------------------------------------------------------------
        # Momentum regime – EWMA(|Δp|) > 1 ¢ ?
        # ----------------------------------------------------------------
        self.ewma_abs_dp = self.alpha * self.ewma_abs_dp + (1 - self.alpha) * abs(dp)
        is_momentum = self.ewma_abs_dp > 0.01          # threshold at 1 cent

        # ----------------------------------------------------------------
        # Break‑out regime – mid‑price close ( < 1 ¢ ) to 0.00 or 0.50 level
        # ----------------------------------------------------------------
        is_breakout = abs((mid * 2) % 1) < 0.01        # distance to 0 or 0.50

        # ----------------------------------------------------------------
        # size  – sum of displayed depth on best bid and best ask
        # ----------------------------------------------------------------
        return dict(
            dp=dp,
            spread=spread,
            size=row.sizeBid + row.sizeAsk,
            is_momentum=is_momentum,
            is_breakout=is_breakout,
        )

# ------------------------------------------------------------
# 2.  QuoteModel – incremental learner / transition table
# ------------------------------------------------------------

class QuoteModel:
    """Very small non‑parametric model learnt online.

    The model estimates two things **per (regime) combination**:

    1. **λ** – empirical mean number of ticks per second, used as the Poisson
       parameter to sample *how many* ticks will occur next second.
    2. **Multinomial distribution** over the discretised tuple
       `(Δp_bin, spread_bin, size_bin)` *conditionally* on the **sign** of Δp.
    """

    # ------------------------------------------------------------------
    # Construction helpers – discretisation
    # ------------------------------------------------------------------
    @staticmethod
    def _bin(x: float, quantum: float) -> int:
        """Round *x* to nearest multiple of *quantum* and return the **index**."""
        return int(round(x / quantum))

    # ------------------------------------------------------------------
    # Constructor
    # ------------------------------------------------------------------
    def __init__(self):
        # self.transition[(regime, sign)][(dp_bin, spread_bin, size_bin)] = count
        self.transition: defaultdict[
            tuple[tuple[str, str], str], Counter
        ] = defaultdict(Counter)

        # For λ estimation
        self.ticks_per_regime: Counter[tuple[str, str]] = Counter()
        self.seconds_per_regime: Counter[tuple[str, str]] = Counter()

    # ------------------------------------------------------------------
    # Learning API – called once per **second** of historical data
    # ------------------------------------------------------------------
    def update_second(self, feats: list[dict]):
        """Update the model with the **list of features inside one second**.
        ``feats`` must be time‑ordered.
        """
        # --------------------------------------------------------------
        # 1)  Determine the regime of *this* second
        # --------------------------------------------------------------
        regime = (
            "M" if any(f["is_momentum"] for f in feats) else "N",
            "B" if any(f["is_breakout"] for f in feats) else "O",
        )

        # --------------------------------------------------------------
        # 2)  Determine the sign of the last tick in that second
        # --------------------------------------------------------------
        sign = (
            "U" if feats[-1]["dp"] > 0 else "D" if feats[-1]["dp"] < 0 else "F"
        )

        # --------------------------------------------------------------
        # 3)  Update λ estimators (Poisson intensity)
        # --------------------------------------------------------------
        self.ticks_per_regime[regime] += len(feats)
        self.seconds_per_regime[regime] += 1

        # --------------------------------------------------------------
        # 4)  Update the discrete transition table for *each* tick
        # --------------------------------------------------------------
        for f in feats:
            key = (regime, sign)
            val = (
                self._bin(f["dp"], 0.005),     # Δp binned to 0.5 cent
                self._bin(f["spread"], 0.01),  # spread binned to 1 cent
                self._bin(f["size"], 100),     # size binned to 100 shares
            )
            self.transition[key][val] += 1

    # ------------------------  sampling helpers -----------------------
    def _lambda(self, regime: tuple[str, str]) -> float:
        """Return empirical λ = avg ticks/sec for *regime*."""
        secs = max(1, self.seconds_per_regime[regime])  # avoid div/0
        return self.ticks_per_regime[regime] / secs

    def sample_nb_updates(self, regime: tuple[str, str]) -> int:
        """Poisson draw – *how many* ticks in the coming second?"""
        lam = self._lambda(regime)
        return np.random.poisson(lam)

    def sample_tick(self, regime: tuple[str, str], sign: str) -> dict:
        """Multinomial draw – pick (Δp, spread, size) for one tick."""
        bucket: Counter = self.transition[(regime, sign)]
        if not bucket:       # Edge case – never seen this (regime, sign)
            return dict(dp=0, spread=0.01, size=100)

        values, weights = zip(*bucket.items())
        dp_bin, sp_bin, sz_bin = random.choices(values, weights=weights)[0]
        return dict(
            dp=dp_bin * 0.005,
            spread=sp_bin * 0.01,
            size=sz_bin * 100,
        )

# ------------------------------------------------------------
# 3.  QuoteGenerator – produce synthetic ticks for the simulator
# ------------------------------------------------------------

class QuoteGenerator:
    """Light wrapper turning a :class:`QuoteModel` into a tick generator."""

    def __init__(self, model: QuoteModel, bid0: float, ask0: float):
        self.model = model
        self.bid = bid0
        self.ask = ask0

    # ------------------------------------------------------------------
    # Public API – produce **all** ticks for second *ts*
    # ------------------------------------------------------------------
    def step_second(
        self,
        ts,                     # datetime of the *second* we simulate
        regime: tuple[str, str] = ("N", "O"),
        sign: str = "F",        # sign of previous tick in *previous second*
    ) -> list[dict]:
        """Generate and return the list of ticks occurring in second *ts*.

        The caller supplies its *current* view of the market (`regime`) so the
        generator can switch context on‑the‑fly (e.g. when a break‑out gets
        detected).  ``sign`` must be the sign of the *last* tick we generated –
        this keeps the Markov chain coherent across seconds.
        """
        n = self.model.sample_nb_updates(regime)
        ticks: list[dict] = []
        for _ in range(n):
            t = self.model.sample_tick(regime, sign)

            # ----------------------------------------------------------
            # 1)  Update our synthetic best bid / ask
            # ----------------------------------------------------------
            self.bid += t["dp"]
            # ensure at least 1 cent of spread
            self.ask = max(self.bid + t["spread"], self.bid + 0.01)

            # ----------------------------------------------------------
            # 2)  Push formalised tick to output list
            # ----------------------------------------------------------
            ticks.append(
                dict(
                    time=ts,
                    priceBid=round(self.bid, 2),
                    priceAsk=round(self.ask, 2),
                    sizeBid=t["size"] // 2,
                    sizeAsk=t["size"] // 2,
                )
            )

            # ----------------------------------------------------------
            # 3)  Prepare *sign* for the next tick
            # ----------------------------------------------------------
            sign = "U" if t["dp"] > 0 else ("D" if t["dp"] < 0 else "F")
        return ticks
