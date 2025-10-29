# constants.py
import pygame, datetime

# Écran & UI
SCREEN_WIDTH    = 640
SCREEN_HEIGHT   = 480
REFRESH_RATE    = 3  # FPS

# Réaction
INITIAL_REACTION_WINDOW = 1.0
MIN_REACTION_WINDOW     = 0.12
WINDOW_DECREASE_FACTOR  = 0.90
ADAPTIVE_WINDOW_CHECK   = 20
SUCCESS_THRESHOLD       = 0.80

# Fichiers
FONT_NAME = "arial"
CSV_FILE  = f"obr_trainer_stats_{datetime.datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
MODEL_FILE = "model.pkl"

# Couleurs
BG_COLOR     = (30, 30, 30)
COL_BG_COLOR = (193, 193, 193)
PANEL_COLOR  = (45, 45, 45)
SIGNAL_COLOR = (0, 200, 0)
TEXT_COLOR   = (30, 30, 30)
ERROR_COLOR  = (255, 60, 60)

# Couleurs par rang NBBO (vert → rose → jaune → bleu → gris)
ROW_COLORS = [
    (0x57, 0xfe, 0x01),   # green  – meilleur prix
    (0xfd, 0x80, 0x7f),   # rose   – 2ᵉ meilleur
    (0xfb, 0xfe, 0x01),   # yellow – 3ᵉ meilleur
    (0x03, 0xfe, 0xf9),   # blue   – 4ᵉ meilleur
]
DEFAULT_ROW_COLOR = COL_BG_COLOR          # gris (#c1c1c1)

# Raccourcis
ENTRY_KEY = pygame.K_F1
EXIT_KEY  = pygame.K_F12
