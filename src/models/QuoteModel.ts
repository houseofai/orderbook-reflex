// QuoteModel.ts - Converted from modelisation/simulate_quotes.py

type Regime = [string, string]; // [Momentum, Breakout] e.g. ["N", "O"]
type Sign = "U" | "D" | "F"; // Up, Down, Flat

interface TransitionData {
  [key: string]: { [binKey: string]: number }; // RegimeSignKey -> BinKey -> count
}

interface RegimeCounter {
  [key: string]: number; // "regime0,regime1" -> count
}

interface ModelData {
  transition: TransitionData;
  ticks_per_regime: RegimeCounter;
  seconds_per_regime: RegimeCounter;
}

export class QuoteModel {
  private transition: Map<string, Map<string, number>>;
  private ticksPerRegime: Map<string, number>;
  private secondsPerRegime: Map<string, number>;

  constructor(modelData?: ModelData) {
    this.transition = new Map();
    this.ticksPerRegime = new Map();
    this.secondsPerRegime = new Map();

    if (modelData) {
      this.loadFromJSON(modelData);
    }
  }

  private loadFromJSON(data: ModelData): void {
    // Load transition data
    for (const [key, value] of Object.entries(data.transition)) {
      const innerMap = new Map<string, number>();
      for (const [binKey, count] of Object.entries(value)) {
        innerMap.set(binKey, count);
      }
      this.transition.set(key, innerMap);
    }

    // Load regime counters
    for (const [key, value] of Object.entries(data.ticks_per_regime)) {
      this.ticksPerRegime.set(key, value);
    }
    for (const [key, value] of Object.entries(data.seconds_per_regime)) {
      this.secondsPerRegime.set(key, value);
    }
  }

  private lambda(regime: Regime): number {
    const key = regime.join(",");
    const secs = Math.max(1, this.secondsPerRegime.get(key) || 1);
    const ticks = this.ticksPerRegime.get(key) || 0;
    return ticks / secs;
  }

  private poissonSample(lambda: number): number {
    // Simple Poisson sampling using Knuth's algorithm
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= Math.random();
    } while (p > L);
    return k - 1;
  }

  sampleNbUpdates(regime: Regime): number {
    const lam = this.lambda(regime);
    return this.poissonSample(lam);
  }

  sampleTick(regime: Regime, sign: Sign): { dp: number; spread: number; size: number } {
    const key = `${regime[0]},${regime[1]},${sign}`;
    const bucket = this.transition.get(key);

    if (!bucket || bucket.size === 0) {
      return { dp: 0, spread: 0.01, size: 100 };
    }

    // Convert to arrays for weighted random selection
    const entries = Array.from(bucket.entries());
    const totalWeight = entries.reduce((sum, [_, weight]) => sum + weight, 0);
    let random = Math.random() * totalWeight;

    for (const [binKey, weight] of entries) {
      random -= weight;
      if (random <= 0) {
        const [dpBin, spBin, szBin] = binKey.split(",").map(Number);
        return {
          dp: dpBin * 0.005,
          spread: spBin * 0.01,
          size: szBin * 100,
        };
      }
    }

    // Fallback
    return { dp: 0, spread: 0.01, size: 100 };
  }
}

export class QuoteGenerator {
  private model: QuoteModel;
  private bid: number;
  private ask: number;

  constructor(model: QuoteModel, bid0: number, ask0: number) {
    this.model = model;
    this.bid = bid0;
    this.ask = ask0;
  }

  stepSecond(
    ts: Date,
    regime: Regime = ["N", "O"],
    sign: Sign = "F"
  ): Array<{
    time: Date;
    priceBid: number;
    priceAsk: number;
    sizeBid: number;
    sizeAsk: number;
  }> {
    const n = this.model.sampleNbUpdates(regime);
    const ticks: Array<any> = [];

    let currentSign = sign;
    for (let i = 0; i < n; i++) {
      const t = this.model.sampleTick(regime, currentSign);

      // Update synthetic bid/ask
      this.bid += t.dp;
      this.ask = Math.max(this.bid + t.spread, this.bid + 0.01);

      ticks.push({
        time: ts,
        priceBid: Math.round(this.bid * 100) / 100,
        priceAsk: Math.round(this.ask * 100) / 100,
        sizeBid: Math.floor(t.size / 2),
        sizeAsk: Math.floor(t.size / 2),
      });

      // Update sign for next tick
      currentSign = t.dp > 0 ? "U" : t.dp < 0 ? "D" : "F";
    }

    return ticks;
  }

  getBid(): number {
    return this.bid;
  }

  getAsk(): number {
    return this.ask;
  }
}
