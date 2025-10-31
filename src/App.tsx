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

function App() {
  const [priceModel, setPriceModel] = useState<PriceModel | null>(null);
  const [signalModel] = useState<SignalModel>(() => new SignalModel());
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [lastRt, setLastRt] = useState<number | null>(null);
  const [, setUpdateTrigger] = useState(0);

  const animationFrameRef = useRef<number>();
  const lastUpdateRef = useRef<number>(0);

  // Load model on mount
  useEffect(() => {
    const loadModel = async () => {
      try {
        // Try to load the model JSON
        const response = await fetch("/models/model.json");
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

  // Keyboard event handler
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!priceModel) return;

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

      const ok = signalModel.recordReaction(event.key, now);

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
    [priceModel, signalModel]
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
      if (timestamp - lastUpdateRef.current >= updateInterval) {
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
  }, [priceModel, signalModel]);

  if (!priceModel) {
    return (
      <div className="loading">
        <h2>Loading OrderBook Reflex Trainer...</h2>
      </div>
    );
  }

  return (
    <div className="app">
      <h1 className="title">OrderBook Reflex Trainer</h1>

      <div className="main-content">
        <StatsPanel
          reactionWindow={signalModel.reactionWindow}
          lastRt={lastRt}
          history={history}
          maxHistoryRows={10}
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

      <div className="help-text">
        Press {ENTRY_KEY} on PL (Entry) / {EXIT_KEY} on PH (Exit)
      </div>
    </div>
  );
}

export default App;
