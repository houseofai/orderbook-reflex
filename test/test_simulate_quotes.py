# tests/test_quote_generator.py
import unittest, datetime, pickle, os

from src.simulate_quotes import QuoteGenerator


class TestQuoteGenerator(unittest.TestCase):
    """Série de sanity-checks sur la qualité des quotes produits."""

    # --- paramètres ------------------------------------------------------
    MODEL_PATH          = "model.pkl"   # modèle entraîné
    SEED_BID, SEED_ASK  = 100.00, 100.02
    SECONDS_TO_SIMULATE = 60   *1000         # 1 minute
    MIN_SIZE            = 100           # taille mini par côté
    MAX_SPREAD          = 0.05          # écart max bid/ask ($)
    MIN_UNIQUE_BIDS     = 5             # variété de prix par minute

    # --- helpers ---------------------------------------------------------
    def setUp(self):
        if not os.path.exists(self.MODEL_PATH):
            self.skipTest("Modèle manquant : %s" % self.MODEL_PATH)

        with open(self.MODEL_PATH, "rb") as f:
            model = pickle.load(f)
        self.gen = QuoteGenerator(model, self.SEED_BID, self.SEED_ASK)

        # run 1 minute de simulation
        t0 = datetime.datetime.now(datetime.timezone.utc)
        self.quotes = []
        for i in range(self.SECONDS_TO_SIMULATE):
            ts = t0 + datetime.timedelta(seconds=i)
            self.quotes.extend(self.gen.step_second(ts))

        # sécurité : s’assurer qu’on a bien des ticks !
        self.assertGreater(len(self.quotes), 0, "Aucun tick généré !")

    # --- tests -----------------------------------------------------------
    def test_sizes_above_threshold(self):
        """Bid & Ask size > MIN_SIZE"""
        for q in self.quotes:
            self.assertGreaterEqual(q["sizeBid"], self.MIN_SIZE)
            self.assertGreaterEqual(q["sizeAsk"], self.MIN_SIZE)

    def test_positive_prices(self):
        """Prix strictement positifs"""
        for q in self.quotes:
            self.assertGreater(q["priceBid"], 0)
            self.assertGreater(q["priceAsk"], 0)

    def test_bid_below_ask(self):
        """Toujours bid < ask"""
        for q in self.quotes:
            self.assertLess(q["priceBid"], q["priceAsk"])

    def test_spread_not_too_large(self):
        """Spread (ask-bid) ≤ MAX_SPREAD"""
        for q in self.quotes:
            spread = q["priceAsk"] - q["priceBid"]
            self.assertLessEqual(spread, self.MAX_SPREAD)

    def test_price_diversity_in_one_minute(self):
        """Au moins MIN_UNIQUE_BIDS niveaux de bid distincts sur 1 minute"""
        unique_bids = {q["priceBid"] for q in self.quotes}
        self.assertGreaterEqual(len(unique_bids), self.MIN_UNIQUE_BIDS)

# -----------------------------------------------------------------------
if __name__ == "__main__":
    unittest.main()
