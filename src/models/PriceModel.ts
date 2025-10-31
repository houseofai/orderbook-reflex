// PriceModel.ts - Converted from price_model.py

import { QuoteModel, QuoteGenerator } from "./QuoteModel";
import { ExchangeBookGenerator, Quote } from "./ExchangeBookGenerator";

interface BufferEntry {
  bid: number;
  ask: number;
  mid: number;
}

export class PriceModel {
  private generator: QuoteGenerator;
  private exchangeGen: ExchangeBookGenerator;
  private window: number;
  private buffer: BufferEntry[];
  private maxBufferSize: number;

  public lastExchangeQuotes: Quote[];
  public pivot: "PL" | "PH" | null;
  public pivotBid: number;
  public pivotAsk: number;
  public bestBid: number;
  public bestAsk: number;

  constructor(
    quoteModel: QuoteModel,
    _tickSize: number = 0.01,
    spread: number = 0.02,
    windowSeconds: number = 30
  ) {
    const baseBid = 100.0;
    const baseAsk = baseBid + spread;

    this.generator = new QuoteGenerator(quoteModel, baseBid, baseAsk);
    this.exchangeGen = new ExchangeBookGenerator(undefined, undefined, 42);
    this.lastExchangeQuotes = [];

    this.window = windowSeconds;

    // Initialize buffer
    this.maxBufferSize = 2 * windowSeconds + 1;
    this.buffer = [];
    for (let i = 0; i < this.maxBufferSize; i++) {
      this.buffer.push({
        bid: baseBid,
        ask: baseAsk,
        mid: (baseBid + baseAsk) / 2,
      });
    }

    this.pivot = null;
    this.pivotBid = baseBid;
    this.pivotAsk = baseAsk;
    this.bestBid = baseBid;
    this.bestAsk = baseAsk;
  }

  update(): void {
    const nowDt = new Date();

    // Generate tick
    const ticks = this.generator.stepSecond(nowDt, ["N", "O"], "F");

    let bid: number;
    let ask: number;
    let mid: number;

    if (ticks.length > 0) {
      const last = ticks[ticks.length - 1];
      this.lastExchangeQuotes = this.exchangeGen.generate(last);
      bid = last.priceBid;
      ask = last.priceAsk;
      mid = (bid + ask) / 2;
      this.bestBid = bid;
      this.bestAsk = ask;
    } else {
      // No variation, reuse last price
      const lastEntry = this.buffer[this.buffer.length - 1];
      bid = lastEntry.bid;
      ask = lastEntry.ask;
      mid = lastEntry.mid;
    }

    // Update buffer (append to end, remove from beginning)
    this.buffer.push({ bid, ask, mid });
    if (this.buffer.length > this.maxBufferSize) {
      this.buffer.shift();
    }

    // Detect pivot at window position in the past
    if (this.buffer.length === this.maxBufferSize) {
      const centre = this.buffer[this.window];
      const mids = this.buffer.map((e) => e.mid);

      const maxMid = Math.max(...mids);
      const minMid = Math.min(...mids);

      if (centre.mid === maxMid) {
        this.pivot = "PH"; // Pivot High
      } else if (centre.mid === minMid) {
        this.pivot = "PL"; // Pivot Low
      } else {
        this.pivot = null;
      }

      this.pivotBid = centre.bid;
      this.pivotAsk = centre.ask;
    }
  }
}
