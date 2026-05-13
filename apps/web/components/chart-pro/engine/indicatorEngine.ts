/**
 * indicatorEngine.ts
 * Computes technical indicators from OHLCV data.
 * All functions return number[] with NaN for positions where data is insufficient.
 */

// ─── SMA ────────────────────────────────────────────────────────────────────

/**
 * Simple Moving Average
 * @param data   Array of numeric values (e.g. close prices)
 * @param period Lookback period
 */
export function SMA(data: number[], period: number): number[] {
  const result: number[] = new Array(data.length).fill(NaN);
  if (period <= 0 || data.length < period) return result;

  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  result[period - 1] = sum / period;

  for (let i = period; i < data.length; i++) {
    sum += data[i] - data[i - period];
    result[i] = sum / period;
  }
  return result;
}

// ─── EMA ────────────────────────────────────────────────────────────────────

/**
 * Exponential Moving Average
 * @param data   Array of numeric values
 * @param period Lookback period
 */
export function EMA(data: number[], period: number): number[] {
  const result: number[] = new Array(data.length).fill(NaN);
  if (period <= 0 || data.length < period) return result;

  const k = 2 / (period + 1);

  // Seed with SMA of first `period` values
  let sum = 0;
  for (let i = 0; i < period; i++) sum += data[i];
  result[period - 1] = sum / period;

  for (let i = period; i < data.length; i++) {
    result[i] = data[i] * k + result[i - 1] * (1 - k);
  }
  return result;
}

// ─── RSI ────────────────────────────────────────────────────────────────────

/**
 * Relative Strength Index (Wilder smoothing)
 * @param closes Array of close prices
 * @param period Lookback period (default 14)
 */
export function RSI(closes: number[], period: number = 14): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (period <= 0 || closes.length <= period) return result;

  let avgGain = 0;
  let avgLoss = 0;

  // First average gain/loss over the seed window
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  const rs0 = avgLoss === 0 ? Infinity : avgGain / avgLoss;
  result[period] = 100 - 100 / (1 + rs0);

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    const rs = avgLoss === 0 ? Infinity : avgGain / avgLoss;
    result[i] = 100 - 100 / (1 + rs);
  }
  return result;
}

// ─── MACD ───────────────────────────────────────────────────────────────────

export interface MACDResult {
  macd: number[];
  signal: number[];
  histogram: number[];
}

/**
 * Moving Average Convergence / Divergence
 * @param closes     Array of close prices
 * @param fast       Fast EMA period (default 12)
 * @param slow       Slow EMA period (default 26)
 * @param signalPeriod Signal EMA period (default 9)
 */
export function MACD(
  closes: number[],
  fast: number = 12,
  slow: number = 26,
  signalPeriod: number = 9,
): MACDResult {
  const len = closes.length;
  const macdLine: number[] = new Array(len).fill(NaN);
  const signalLine: number[] = new Array(len).fill(NaN);
  const histogram: number[] = new Array(len).fill(NaN);

  const fastEma = EMA(closes, fast);
  const slowEma = EMA(closes, slow);

  // MACD line = fastEMA - slowEMA (valid only where both are defined)
  for (let i = slow - 1; i < len; i++) {
    if (!isNaN(fastEma[i]) && !isNaN(slowEma[i])) {
      macdLine[i] = fastEma[i] - slowEma[i];
    }
  }

  // Extract valid MACD values for signal EMA calculation
  const firstValidIdx = slow - 1;
  const macdValues = macdLine.slice(firstValidIdx);
  const signalValues = EMA(macdValues, signalPeriod);

  for (let i = 0; i < signalValues.length; i++) {
    const globalIdx = firstValidIdx + i;
    signalLine[globalIdx] = signalValues[i];
    if (!isNaN(macdLine[globalIdx]) && !isNaN(signalValues[i])) {
      histogram[globalIdx] = macdLine[globalIdx] - signalValues[i];
    }
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

// ─── Bollinger Bands ─────────────────────────────────────────────────────────

export interface BollingerBandsResult {
  upper: number[];
  middle: number[];
  lower: number[];
}

/**
 * Bollinger Bands
 * @param closes  Array of close prices
 * @param period  SMA period (default 20)
 * @param stdDev  Standard deviation multiplier (default 2)
 */
export function BollingerBands(
  closes: number[],
  period: number = 20,
  stdDev: number = 2,
): BollingerBandsResult {
  const len = closes.length;
  const upper: number[] = new Array(len).fill(NaN);
  const middle: number[] = new Array(len).fill(NaN);
  const lower: number[] = new Array(len).fill(NaN);

  if (period <= 0 || len < period) return { upper, middle, lower };

  const sma = SMA(closes, period);

  for (let i = period - 1; i < len; i++) {
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = sma[i];
    const variance = slice.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);

    middle[i] = mean;
    upper[i] = mean + stdDev * sd;
    lower[i] = mean - stdDev * sd;
  }

  return { upper, middle, lower };
}
