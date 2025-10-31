// App.tsx - Main application component

import { useState, useEffect, useRef, useCallback } from "react";
import { StatsPanel } from "./components/StatsPanel";
import { OrderBookColumn } from "./components/OrderBookColumn";
import { PriceModel } from "./models/PriceModel";
import { SignalModel } from "./models/SignalModel";
import { QuoteModel } from "./models/QuoteModel";
import { REFRESH_RATE, ENTRY_KEY, EXIT_KEY } from "./constants";
import "./App.css";

interface HistoryEntry {
  dir: string;
  sigPrice: number;
  userPrice: number;
  rt: number;
  ok: boolean;
}

interface HotkeyConfig {
  entry: string;
  exit: string;
  pause: string;
}

function App() {
  const [priceModel, setPriceModel] = useState<PriceModel | null>(null);
  const [signalModel] = useState<SignalModel>(() => new SignalModel());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [lastRt, setLastRt] = useState<number | null>(null);
  const [, setUpdateTrigger] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [showHotkeyConfig, setShowHotkeyConfig] = useState(false);
  const [hotkeys, setHotkeys] = useState<HotkeyConfig>(() => {
    const saved = localStorage.getItem("hotkeys");
    return saved ? JSON.parse(saved) : { entry: ENTRY_KEY, exit: EXIT_KEY, pause: " " };
  });

  const animationFrameRef = useRef<number>();
  const lastUpdateRef = useRef<number>(0);

  // Load model on mount
  useEffect(() => {
    const loadModel = async () => {
      try {
        // Try to load the model JSON using relative path
        // This works with base: './' in vite.config.ts for GitHub Pages
        const response = await fetch("./models/model.json");
        if (response.ok) {
          const modelData = await response.json();
          const quoteModel = new QuoteModel(modelData);
          const pm = new PriceModel(quoteModel);
          setPriceModel(pm);
        } else {
          // Model not found, use empty model (will generate minimal data)
          console.warn("Model not found, using empty model");
          const quoteModel = new QuoteModel();
          const pm = new PriceModel(quoteModel);
          setPriceModel(pm);
        }
      } catch (error) {
        console.error("Error loading model:", error);
        // Fallback to empty model
        const quoteModel = new QuoteModel();
        const pm = new PriceModel(quoteModel);
        setPriceModel(pm);
      }
    };

    loadModel();
  }, []);

  // Save hotkeys to localStorage
  useEffect(() => {
    localStorage.setItem("hotkeys", JSON.stringify(hotkeys));
  }, [hotkeys]);

  // Toggle pause
  const togglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  // Keyboard event handler
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // Handle pause key
      if (event.key === hotkeys.pause) {
        event.preventDefault();
        togglePause();
        return;
      }

      if (!priceModel || isPaused) return;

      const now = performance.now() / 1000;
      const dirActive = signalModel.currentSignal;

      let sigPrice: number = 0;
      let userPrice: number = 0;

      if (dirActive) {
        if (dirActive === "ENTRY") {
          sigPrice = priceModel.pivotBid;
          userPrice = priceModel.bestBid;
        } else {
          sigPrice = priceModel.pivotAsk;
          userPrice = priceModel.bestAsk;
        }
      }

      const ok = signalModel.recordReactionWithKey(event.key, now, hotkeys.entry, hotkeys.exit);

      if (dirActive && signalModel.signalTimestamp !== null) {
        const rt = now - signalModel.signalTimestamp;
        const newEntry: HistoryEntry = {
          dir: dirActive,
          sigPrice,
          userPrice,
          rt,
          ok,
        };

        setHistory((prev) => [...prev.slice(-49), newEntry]);
        setLastRt(rt);
      }
    },
    [priceModel, signalModel, hotkeys, isPaused, togglePause]
  );

  // Setup keyboard listener
  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Game loop
  useEffect(() => {
    if (!priceModel) return;

    const updateInterval = 1000 / REFRESH_RATE;

    const gameLoop = (timestamp: number) => {
      if (!isPaused && timestamp - lastUpdateRef.current >= updateInterval) {
        const now = performance.now() / 1000;

        // Update price model
        priceModel.update();

        // Trigger signal when pivot appears
        const pivot = priceModel.pivot;
        if (pivot && signalModel.currentSignal === null) {
          const sig = pivot === "PL" ? "ENTRY" : "EXIT";
          signalModel.trigger(sig, now);
        }

        setUpdateTrigger((prev) => prev + 1);
        lastUpdateRef.current = timestamp;
      }

      animationFrameRef.current = requestAnimationFrame(gameLoop);
    };

    animationFrameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [priceModel, signalModel, isPaused]);

  if (!priceModel) {
    return (
      <div className="loading">
        <h2>Loading OrderBook Reflex Trainer...</h2>
      </div>
    );
  }

  // Calculate comprehensive stats
  const calculateStats = () => {
    if (history.length === 0) {
      return {
        avgReactionTime: 0,
        successRate: 0,
        avgPriceDiff: 0,
        totalTrades: 0,
        successfulTrades: 0,
      };
    }

    const totalTrades = history.length;
    const successfulTrades = history.filter((h) => h.ok).length;
    const successRate = (successfulTrades / totalTrades) * 100;
    const avgReactionTime = history.reduce((sum, h) => sum + h.rt, 0) / totalTrades;
    const avgPriceDiff = history.reduce((sum, h) => sum + Math.abs(h.userPrice - h.sigPrice), 0) / totalTrades;

    return {
      avgReactionTime,
      successRate,
      avgPriceDiff,
      totalTrades,
      successfulTrades,
    };
  };

  const stats = calculateStats();

  return (
    <div className="app">
      <div className="header">
        <h1 className="title">OrderBook Reflex Trainer</h1>
        <div className="controls">
          <button className="control-btn" onClick={togglePause}>
            {isPaused ? "▶ Resume" : "⏸ Pause"}
          </button>
          <button className="control-btn" onClick={() => setShowHotkeyConfig(!showHotkeyConfig)}>
            ⚙ Hotkeys
          </button>
        </div>
      </div>

      {showHotkeyConfig && (
        <div className="hotkey-config">
          <div className="config-header">Configure Hotkeys</div>
          <div className="config-row">
            <label>Entry Signal:</label>
            <input
              type="text"
              value={hotkeys.entry}
              onChange={(e) => setHotkeys({ ...hotkeys, entry: e.target.value })}
              maxLength={3}
            />
          </div>
          <div className="config-row">
            <label>Exit Signal:</label>
            <input
              type="text"
              value={hotkeys.exit}
              onChange={(e) => setHotkeys({ ...hotkeys, exit: e.target.value })}
              maxLength={3}
            />
          </div>
          <div className="config-row">
            <label>Pause/Resume:</label>
            <input
              type="text"
              value={hotkeys.pause === " " ? "Space" : hotkeys.pause}
              onChange={(e) => {
                const val = e.target.value;
                setHotkeys({ ...hotkeys, pause: val === "Space" ? " " : val });
              }}
              maxLength={5}
            />
          </div>
          <button className="config-close" onClick={() => setShowHotkeyConfig(false)}>
            Close
          </button>
        </div>
      )}

      <div className="main-content">
        <StatsPanel
          reactionWindow={signalModel.reactionWindow}
          lastRt={lastRt}
          history={history}
          maxHistoryRows={10}
          stats={stats}
        />

        <OrderBookColumn
          quotes={priceModel.lastExchangeQuotes}
          side="bid"
          highlighted={signalModel.currentSignal === "ENTRY"}
        />

        <OrderBookColumn
          quotes={priceModel.lastExchangeQuotes}
          side="ask"
          highlighted={signalModel.currentSignal === "EXIT"}
        />
      </div>

      <div className="footer">
        <div className="help-text">
          {isPaused ? (
            <span className="paused-text">PAUSED - Press {hotkeys.pause === " " ? "Space" : hotkeys.pause} to resume</span>
          ) : (
            <>Press {hotkeys.entry} on PL (Entry) / {hotkeys.exit} on PH (Exit) | {hotkeys.pause === " " ? "Space" : hotkeys.pause} to pause</>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
