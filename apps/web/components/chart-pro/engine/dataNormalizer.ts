export interface KLineBar {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface RawCandle {
  t: number; o: number; h: number; l: number; c: number; v: number;
}

export function normalizeCandles(raw: RawCandle[]): KLineBar[] {
  return raw
    .filter(c => c.t > 0 && isFinite(c.o) && isFinite(c.h) && isFinite(c.l) && isFinite(c.c))
    .map(c => ({
      timestamp: c.t,
      open: c.o,
      high: c.h,
      low: c.l,
      close: c.c,
      volume: c.v || 0,
    }))
    .sort((a, b) => a.timestamp - b.timestamp);
}

export function detectDataGaps(bars: KLineBar[], expectedInterval: number): number[] {
  const gaps: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const diff = bars[i].timestamp - bars[i - 1].timestamp;
    if (diff > expectedInterval * 2) gaps.push(i);
  }
  return gaps;
}

export function getTimeframeMs(tf: string): number {
  const map: Record<string, number> = {
    '1M_TF': 60000, '5M': 300000, '15M': 900000, '1H': 3600000,
    '4H': 14400000, '1D': 86400000, '1W': 604800000, '1MO': 2592000000,
  };
  return map[tf] || 3600000;
}
