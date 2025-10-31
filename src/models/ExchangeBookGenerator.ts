// ExchangeBookGenerator.ts - Converted from exchangebookgenerator.py

export interface Quote {
  time: Date;
  exchange: string;
  priceBid: number;
  sizeBid: number;
  priceAsk: number;
  sizeAsk: number;
}

interface Tick {
  time: Date;
  priceBid: number;
  priceAsk: number;
  sizeBid: number;
  sizeAsk: number;
}

export class ExchangeBookGenerator {
  private static readonly TICK = 0.01;

  private static readonly DEFAULT_SHARES: Record<string, number> = {
    NSDQ: 0.30,
    ARCA: 0.18,
    BATS: 0.10,
    BATY: 0.06,
    EDGA: 0.03,
    EDGX: 0.07,
    IEXG: 0.05,
    AMEX: 0.03,
    NYSE: 0.12,
    PHLX: 0.01,
    MEMX: 0.03,
    MIAX: 0.01,
    BOSX: 0.00,
    LTSE: 0.01,
  };

  private static readonly DEFAULT_OFFSETS: Record<number, number> = {
    0: 0.35,
    1: 0.30,
    "-1": 0.20,
    2: 0.10,
    "-2": 0.05,
  };

  private exchs: string[];
  private shareP: number[];
  private kvals: number[];
  private offsetP: number[];
  private rng: () => number;

  constructor(
    shares?: Record<string, number>,
    offsetsP?: Record<number, number>,
    seed?: number
  ) {
    const sharesData = shares || ExchangeBookGenerator.DEFAULT_SHARES;
    const offsetsData = offsetsP || ExchangeBookGenerator.DEFAULT_OFFSETS;

    // Setup market shares
    const totalShare = Object.values(sharesData).reduce((a, b) => a + b, 0);
    if (totalShare === 0) {
      throw new Error("Sum of market shares must be > 0");
    }

    this.exchs = Object.keys(sharesData);
    this.shareP = Object.values(sharesData).map((v) => v / totalShare);

    // Setup offsets
    this.kvals = Object.keys(offsetsData).map(Number);
    const probs = Object.values(offsetsData);
    const totalProb = probs.reduce((a, b) => a + b, 0);
    this.offsetP = probs.map((p) => p / totalProb);

    // Simple seeded random (not cryptographically secure)
    if (seed !== undefined) {
      let s = seed;
      this.rng = () => {
        s = (s * 9301 + 49297) % 233280;
        return s / 233280;
      };
    } else {
      this.rng = Math.random;
    }
  }

  private pickExchanges(totalSize: number): string[] {
    const maxN = Math.min(7, Math.max(1, Math.floor(totalSize / 100)));
    const n = maxN >= 3 ? Math.floor(this.rng() * (maxN - 2)) + 3 : 1;
    return this.weightedSample(this.exchs, this.shareP, n, false);
  }

  private weightedSample(
    items: string[],
    weights: number[],
    n: number,
    replace: boolean
  ): string[] {
    const result: string[] = [];
    const available = [...items];
    const availableWeights = [...weights];

    for (let i = 0; i < n; i++) {
      const totalWeight = availableWeights.reduce((a, b) => a + b, 0);
      let random = this.rng() * totalWeight;

      for (let j = 0; j < available.length; j++) {
        random -= availableWeights[j];
        if (random <= 0) {
          result.push(available[j]);
          if (!replace) {
            available.splice(j, 1);
            availableWeights.splice(j, 1);
          }
          break;
        }
      }
    }

    return result;
  }

  private dirichletSizes(total: number, n: number): number[] {
    if (n === 1) {
      return [total];
    }

    // Simple Dirichlet approximation using gamma distribution
    const alpha = Array(n).fill(1);
    const gamma = alpha.map(() => {
      // Simple gamma(1,1) approximation
      return -Math.log(this.rng());
    });
    const sum = gamma.reduce((a, b) => a + b, 0);
    const w = gamma.map((g) => g / sum);

    let sizes = w.map((weight) => Math.floor((weight * total) / 100) * 100);

    // Ensure minimum 100 for each
    sizes = sizes.map((s) => (s === 0 ? 100 : s));

    // Adjust to match total
    let diff = total - sizes.reduce((a, b) => a + b, 0);

    while (diff < 0) {
      const maxIdx = sizes.indexOf(Math.max(...sizes));
      if (sizes[maxIdx] > 100) {
        sizes[maxIdx] -= 100;
        diff += 100;
      } else {
        break;
      }
    }

    while (diff > 0) {
      const idx = Math.floor(this.rng() * n);
      sizes[idx] += 100;
      diff -= 100;
    }

    return sizes;
  }

  private drawOffsets(n: number, ensureBest: boolean = false): number[] {
    const k = Array(n)
      .fill(0)
      .map(() => {
        const totalWeight = this.offsetP.reduce((a, b) => a + b, 0);
        let random = this.rng() * totalWeight;
        for (let i = 0; i < this.kvals.length; i++) {
          random -= this.offsetP[i];
          if (random <= 0) {
            return this.kvals[i];
          }
        }
        return this.kvals[0];
      });

    if (ensureBest && !k.includes(0)) {
      k[Math.floor(this.rng() * n)] = 0;
    }

    return k.map((val) => val * ExchangeBookGenerator.TICK);
  }

  generate(tick: Tick): Quote[] {
    const nbboBid = tick.priceBid;
    const nbboAsk = tick.priceAsk;
    const sizeBid = tick.sizeBid;
    const sizeAsk = tick.sizeAsk;

    const exchs = this.pickExchanges(Math.min(sizeBid, sizeAsk));
    const n = exchs.length;

    const bidSizes = this.dirichletSizes(sizeBid, n);
    const askSizes = this.dirichletSizes(sizeAsk, n);

    const bidOff = this.drawOffsets(n, true);
    const askOff = this.drawOffsets(n, true);

    // Ensure NBBO has volume
    const nbboBidIdx = bidOff.findIndex((o) => o === 0);
    if (nbboBidIdx !== -1 && bidSizes[nbboBidIdx] < 100) {
      const deficit = 100 - bidSizes[nbboBidIdx];
      const donor = bidSizes.indexOf(Math.max(...bidSizes));
      if (bidSizes[donor] - deficit >= 100) {
        bidSizes[donor] -= deficit;
        bidSizes[nbboBidIdx] += deficit;
      }
    }

    const nbboAskIdx = askOff.findIndex((o) => o === 0);
    if (nbboAskIdx !== -1 && askSizes[nbboAskIdx] < 100) {
      const deficit = 100 - askSizes[nbboAskIdx];
      const donor = askSizes.indexOf(Math.max(...askSizes));
      if (askSizes[donor] - deficit >= 100) {
        askSizes[donor] -= deficit;
        askSizes[nbboAskIdx] += deficit;
      }
    }

    // Build quotes
    const quotes: Quote[] = [];
    for (let i = 0; i < exchs.length; i++) {
      quotes.push({
        time: tick.time,
        exchange: exchs[i],
        priceBid: Math.round((nbboBid + bidOff[i]) * 100) / 100,
        sizeBid: Math.floor(bidSizes[i]),
        priceAsk: Math.round((nbboAsk + askOff[i]) * 100) / 100,
        sizeAsk: Math.floor(askSizes[i]),
      });
    }

    return quotes;
  }
}
