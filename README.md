# OrderBook Reflex Trainer - React Version

A React-based order book visualization and reaction time trainer. This application helps traders improve their reaction time to market signals (Pivot Lows and Pivot Highs).

## Overview

This is a React/TypeScript conversion of the original Python/Pygame order book trainer. The app:
- Displays real-time bid/ask prices from multiple exchanges
- Detects pivot points (PL = Pivot Low, PH = Pivot High)
- Trains users to react quickly when signals appear
- Tracks reaction times and adapts difficulty
- Can be deployed to GitHub Pages

## Original Python Version

The original Python version is located in the `src/` directory with the following files:
- `app.py` - Entry point
- `orderbook_ui.py` - Pygame UI
- `price_model.py` - Price generation and pivot detection
- `signal_model.py` - Signal management
- `exchangebookgenerator.py` - Multi-exchange order book generation

The `modelisation/` folder contains the quote generation model (unchanged).

## Setup

### 1. Convert the Model

First, convert the pickle model to JSON format:

```bash
python convert_model.py
```

This creates `public/models/model.json` from the pickle file.

### 2. Install Dependencies

```bash
npm install
```

### 3. Run Development Server

```bash
npm run dev
```

The app will be available at `http://localhost:5173`

## Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Deploying to GitHub Pages

1. Push your code to GitHub
2. Enable GitHub Pages in repository settings (Settings → Pages)
3. Set source to "GitHub Actions"
4. The `.github/workflows/deploy.yml` workflow will automatically build and deploy

Your app will be available at: `https://<username>.github.io/<repository-name>/`

## How to Play

1. **Watch the order book** - Bid column (left) and Ask column (right) show prices from multiple exchanges
2. **Wait for signals** - A green border highlights the column when a signal appears:
   - Green border on **Bid** = ENTRY signal (Pivot Low detected)
   - Green border on **Ask** = EXIT signal (Pivot High detected)
3. **React quickly**:
   - Press **F1** when you see ENTRY signal (green border on Bid)
   - Press **F12** when you see EXIT signal (green border on Ask)
4. **Improve** - The reaction window adapts: as you get better, the time window shrinks

## Color Coding

Rows are color-coded by price level:
- 🟢 **Green** - Best price (NBBO)
- 🌸 **Rose** - 2nd best price
- 🟡 **Yellow** - 3rd best price
- 🔵 **Blue** - 4th best price
- ⚪ **Grey** - Other prices

## Stats Panel

- **Wnd**: Current reaction time window (in milliseconds)
- **Last**: Your last reaction time
- **History**: Recent trades showing direction, signal price, and your execution price
  - 🟢 Green = Success (within time window)
  - 🔴 Red = Miss (too slow or wrong key)

## Project Structure

```
.
├── public/
│   ├── index.html          # HTML template
│   └── models/
│       └── model.json      # Converted quote generation model
├── src/
│   ├── components/
│   │   ├── OrderBookColumn.tsx    # Bid/Ask column display
│   │   └── StatsPanel.tsx         # Stats and history panel
│   ├── models/
│   │   ├── QuoteModel.ts          # Quote generation model
│   │   ├── ExchangeBookGenerator.ts # Multi-exchange orderbook
│   │   ├── PriceModel.ts          # Price updates and pivot detection
│   │   └── SignalModel.ts         # Signal triggering and timing
│   ├── App.tsx              # Main application component
│   ├── App.css              # Styling
│   ├── constants.ts         # Configuration constants
│   └── main.tsx             # React entry point
├── modelisation/            # Original Python model (unchanged)
├── models/                  # Pickle model files
├── convert_model.py         # Model conversion script
├── package.json             # Dependencies
├── tsconfig.json            # TypeScript config
└── vite.config.ts           # Vite build config
```

## Technologies

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **CSS** - Styling to match original design

## Notes

- The `modelisation/` folder remains unchanged as requested
- Model is in JSON format (converted from pickle)
- Designed to match the original Python/Pygame version exactly
- Optimized for GitHub Pages deployment
