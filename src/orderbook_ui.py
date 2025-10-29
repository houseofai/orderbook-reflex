import csv
import time
import pygame

from constants import SCREEN_WIDTH, SCREEN_HEIGHT, FONT_NAME, BG_COLOR, PANEL_COLOR, SIGNAL_COLOR, COL_BG_COLOR, \
    TEXT_COLOR, ERROR_COLOR, REFRESH_RATE, CSV_FILE, ROW_COLORS, DEFAULT_ROW_COLOR
from price_model import PriceModel

from signal_model import SignalModel

ROW_H      = 16          # hauteur d’une ligne
MAX_ROWS   = 10          # NBBO + 9 venues possibles
COL_WIDTH  = 200
GAP        = 10

class OrderBookUI:
    def __init__(self) -> None:
        pygame.init()
        self.screen = pygame.display.set_mode((SCREEN_WIDTH, SCREEN_HEIGHT))
        pygame.display.set_caption("OrderBook Reflex Trainer")
        self.clock = pygame.time.Clock()

        # polices
        self.font        = pygame.font.SysFont(FONT_NAME, 14, bold=True)
        self.price_font  = pygame.font.SysFont(FONT_NAME, 11, bold=True)

        # rectangles UI
        self.stats_rect  = pygame.Rect(10, 60, 200, SCREEN_HEIGHT-100)
        self.bid_rect    = pygame.Rect(220, 60, COL_WIDTH,
                                       ROW_H*(MAX_ROWS+1)+8)
        self.ask_rect    = pygame.Rect(220+COL_WIDTH+GAP, 60, COL_WIDTH,
                                       ROW_H*(MAX_ROWS+1)+8)

        # logique
        self.price_model  = PriceModel()
        self.signal_model = SignalModel()

        # variables d’affichage
        self.last_rt          : float | None = None
        self.last_sig_price   : float | None = None
        self.last_user_price  : float | None = None

        # historique (dir, sig, user, rt, ok)
        self.history: list[tuple[str, float, float, float, bool]] = []
        self.max_history_rows = 10

        # aide
        self.help_text = "Press F1 on PL (Entry) / F12 on PH (Exit)"

    def _draw_column(self, rect, rows, side):
        """
        side = 'bid' ou 'ask'
        rows = quotes triées (bids ↓ / asks ↑)
        """
        pygame.draw.rect(self.screen, COL_BG_COLOR, rect)

        # ─── entête ─────────────────────────────────────────────────────────
        hdr = self.price_font.render(side.upper(), True, TEXT_COLOR)
        self.screen.blit(hdr, (rect.x + 5, rect.y + 2))

        # ─── calcul du rang de chaque prix ─────────────────────────────────
        key = "priceBid" if side == "bid" else "priceAsk"
        ranks = {}
        rank = 0
        last = None
        for q in rows[:MAX_ROWS]:
            p = q[key]
            if p != last:  # nouveau niveau de prix
                ranks[p] = rank
                rank += 1
                last = p

        # ─── affichage des lignes ──────────────────────────────────────────
        y0 = rect.y + ROW_H  # 1ʳᵉ ligne sous l’entête
        for i, q in enumerate(rows[:MAX_ROWS]):
            y = y0 + i * ROW_H

            price = q[key]
            r = ranks[price]
            color = ROW_COLORS[r] if r < len(ROW_COLORS) else DEFAULT_ROW_COLOR
            pygame.draw.rect(self.screen, color, pygame.Rect(rect.x, y, rect.width, ROW_H))

            # Exchange
            ex = self.price_font.render(q["exchange"][:5], True, TEXT_COLOR)
            self.screen.blit(ex, (rect.x + 5, y))
            # Prix
            pr = self.price_font.render(f"{price:>7.2f}", True, TEXT_COLOR)
            self.screen.blit(pr, (rect.x + 70, y))
            # Taille
            sz_val = q["sizeBid"] if side == "bid" else q["sizeAsk"]
            sz = self.price_font.render(f"{sz_val:>6}", True, TEXT_COLOR)
            self.screen.blit(sz, (rect.x + 140, y))

    def draw(self) -> None:
        self.screen.fill(BG_COLOR)
        pygame.draw.rect(self.screen, PANEL_COLOR, self.stats_rect)
        y = self.stats_rect.top + 10

        # fenêtre de réaction courante
        wnd_txt = f"Wnd: {self.signal_model.reaction_window * 1000:.0f}ms"
        self.screen.blit(self.font.render(wnd_txt, True, SIGNAL_COLOR),
                         (self.stats_rect.x + 5, y))

        # dernier temps de réaction
        if self.last_rt is not None:
            y += 30
            col = (SIGNAL_COLOR if
                   self.last_rt <= self.signal_model.reaction_window
                   else ERROR_COLOR)
            last_txt = f"Last: {self.last_rt * 1000:.0f}ms"
            self.screen.blit(self.font.render(last_txt, True, col),
                             (self.stats_rect.x + 5, y))

        # ---------------- tableau des coups -----------------------------
        y += 35
        self.screen.blit(self.font.render("DIR  SIG     USER", True, TEXT_COLOR),
                         (self.stats_rect.x + 5, y))

        for dir_, sig_p, user_p, _, ok in reversed(self.history[-self.max_history_rows:]):
            y += 15
            row_col = SIGNAL_COLOR if ok else ERROR_COLOR
            txt = f"{dir_:>4} {sig_p:>7.2f} {user_p:>7.2f}"
            self.screen.blit(self.price_font.render(txt, True, row_col),
                             (self.stats_rect.x + 5, y))

        # ---------- carnet d’ordres (colonnes Bid / Ask) -----------------
        quotes = self.price_model.last_exchange_quotes
        if quotes:
            bids = sorted(quotes, key=lambda q: q["priceBid"], reverse=True)
            asks = sorted(quotes, key=lambda q: q["priceAsk"])
            self._draw_column(self.bid_rect, bids, "bid")
            self._draw_column(self.ask_rect, asks, "ask")

        # aide (footer)
        help_surf = self.font.render(self.help_text, True, TEXT_COLOR)
        self.screen.blit(help_surf,
                         (SCREEN_WIDTH // 2 - help_surf.get_width() // 2,
                          SCREEN_HEIGHT - 30))

        if self.signal_model.current_signal == "ENTRY":  # PL ⇒ Bid
            pygame.draw.rect(self.screen, SIGNAL_COLOR, self.bid_rect, 3)
        elif self.signal_model.current_signal == "EXIT":  # PH ⇒ Ask
            pygame.draw.rect(self.screen, SIGNAL_COLOR, self.ask_rect, 3)

        pygame.display.flip()

    # ------------------------------------------------------------------ #
    # 2)  run  : on mémorise dir / prix / rt / ok dans self.history
    # ------------------------------------------------------------------ #
    def run(self) -> None:
        running = True
        while running:
            now = time.perf_counter()
            self.price_model.update()

            # déclenchement du signal lorsqu’un pivot apparaît
            pivot = self.price_model.pivot
            if pivot and self.signal_model.current_signal is None:
                sig = "ENTRY" if pivot == "PL" else "EXIT"
                self.signal_model.trigger(sig, now)

            # gestion des événements clavier / fenêtre
            for e in pygame.event.get():
                if e.type == pygame.QUIT or (
                        e.type == pygame.KEYDOWN and e.key == pygame.K_ESCAPE
                ):
                    running = False

                # touche F1 / F12 pressée --------------------------------
                elif e.type == pygame.KEYDOWN:
                    dir_active = self.signal_model.current_signal
                    if dir_active:  # un signal est ouvert
                        if dir_active == "ENTRY":
                            sig_price = self.price_model.pivot_bid
                            user_price = self.price_model.best_bid
                        else:
                            sig_price = self.price_model.pivot_ask
                            user_price = self.price_model.best_ask

                    ok = self.signal_model.record_reaction(e.key, now)

                    # si un signal était actif → enreg. dans l’historique
                    if dir_active:
                        rt = now - (self.signal_model.signal_timestamp or now)
                        self.history.append((dir_active, sig_price,
                                             user_price, rt, ok))
                        self.history = self.history[-50:]  # borne mémoire

                        # pour l’affichage instantané
                        self.last_rt = rt
                        self.last_sig_price = sig_price
                        self.last_user_price = user_price

            self.draw()
            self.clock.tick(REFRESH_RATE)

        # ----------------------------------------------------------------
        # export CSV avec les nouvelles colonnes
        with open(CSV_FILE, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(
                ["ts", "dir", "sig_price", "user_price", "rt_ms", "ok"]
            )
            for dir_, sig_p, user_p, rt, ok in self.history:
                writer.writerow(
                    [time.strftime("%Y-%m-%d %H:%M:%S"),
                     dir_, f"{sig_p:.2f}", f"{user_p:.2f}",
                     int(rt * 1000), ok]
                )
        pygame.quit()