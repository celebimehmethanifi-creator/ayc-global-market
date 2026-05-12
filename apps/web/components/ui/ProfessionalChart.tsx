'use client';

import React, {
  useRef,
  useCallback,
  useEffect,
  useState,
  useMemo,
} from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Candle {
  t: number; // Unix timestamp ms
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface OHLCVResponse {
  symbol: string;
  count: number;
  candles: Candle[];
}

type Timeframe = '5M' | '15M' | '1H' | '4H' | '1D' | '1W' | '1M';

interface IndicatorVisibility {
  sma20: boolean;
  sma50: boolean;
  ema12: boolean;
  ema26: boolean;
  bb: boolean;
  rsi: boolean;
  macd: boolean;
  volume: boolean;
}

interface Props {
  symbol: string;
  height?: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants & Theme
// ─────────────────────────────────────────────────────────────────────────────

const TF_OPTIONS: Timeframe[] = ['5M', '15M', '1H', '4H', '1D', '1W', '1M'];

const THEME = {
  bg: '#0C0E16',
  containerBg: '#11121b',
  candleGreen: '#10b981',
  candleRed: '#ef4444',
  gold: '#D4AF37',
  textPrimary: '#e8e8ef',
  textSecondary: 'rgba(232,232,239,0.65)',
  textTertiary: 'rgba(232,232,239,0.35)',
  gridLine: 'rgba(255,255,255,0.04)',
  crosshair: 'rgba(255,255,255,0.35)',
  border: 'rgba(255,255,255,0.06)',
  sma20: '#60a5fa',
  sma50: '#f59e0b',
  ema12: '#a78bfa',
  ema26: '#fb923c',
  bbUpper: 'rgba(148,163,184,0.7)',
  bbLower: 'rgba(148,163,184,0.7)',
  bbMid: 'rgba(148,163,184,0.4)',
  bbFill: 'rgba(148,163,184,0.05)',
  rsiLine: '#818cf8',
  macdLine: '#38bdf8',
  signalLine: '#f472b6',
  macdHistPos: 'rgba(16,185,129,0.7)',
  macdHistNeg: 'rgba(239,68,68,0.7)',
  volumePos: 'rgba(16,185,129,0.35)',
  volumeNeg: 'rgba(239,68,68,0.35)',
  lastPrice: '#D4AF37',
  panelDivider: 'rgba(255,255,255,0.06)',
  fontMono:
    "'JetBrains Mono', 'Fira Mono', 'Cascadia Code', 'Courier New', monospace",
  fontSans:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
} as const;

const Y_AXIS_WIDTH = 72;
const X_AXIS_HEIGHT = 24;
const CANDLE_GAP_RATIO = 0.2;
const MIN_CANDLE_WIDTH = 2;
const MAX_CANDLE_WIDTH = 24;
const SUB_PANEL_HEIGHT = 90; // px per sub-panel

// ─────────────────────────────────────────────────────────────────────────────
// Indicator math
// ─────────────────────────────────────────────────────────────────────────────

function calcSMA(closes: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    let s = 0;
    for (let j = i - period + 1; j <= i; j++) s += closes[j];
    out[i] = s / period;
  }
  return out;
}

function calcEMA(closes: number[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(closes.length).fill(null);
  const k = 2 / (period + 1);
  let ema: number | null = null;
  for (let i = 0; i < closes.length; i++) {
    if (ema === null) {
      if (i >= period - 1) {
        let s = 0;
        for (let j = i - period + 1; j <= i; j++) s += closes[j];
        ema = s / period;
        out[i] = ema;
      }
    } else {
      ema = closes[i] * k + ema * (1 - k);
      out[i] = ema;
    }
  }
  return out;
}

interface BB {
  upper: (number | null)[];
  mid: (number | null)[];
  lower: (number | null)[];
}

function calcBB(closes: number[], period = 20, mult = 2): BB {
  const mid = calcSMA(closes, period);
  const upper: (number | null)[] = new Array(closes.length).fill(null);
  const lower: (number | null)[] = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const m = mid[i] as number;
    const slice = closes.slice(i - period + 1, i + 1);
    const sd = Math.sqrt(
      slice.reduce((acc, v) => acc + (v - m) ** 2, 0) / period,
    );
    upper[i] = m + mult * sd;
    lower[i] = m - mult * sd;
  }
  return { upper, mid, lower };
}

interface RSIResult {
  values: (number | null)[];
}

function calcRSI(closes: number[], period = 14): RSIResult {
  const values: (number | null)[] = new Array(closes.length).fill(null);
  if (closes.length < period + 1) return { values };
  let ag = 0, al = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) ag += d; else al += Math.abs(d);
  }
  ag /= period; al /= period;
  values[period] = 100 - 100 / (1 + (al === 0 ? Infinity : ag / al));
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    ag = (ag * (period - 1) + (d > 0 ? d : 0)) / period;
    al = (al * (period - 1) + (d < 0 ? Math.abs(d) : 0)) / period;
    values[i] = 100 - 100 / (1 + (al === 0 ? Infinity : ag / al));
  }
  return { values };
}

interface MACDResult {
  macd: (number | null)[];
  signal: (number | null)[];
  hist: (number | null)[];
}

function calcMACD(closes: number[], fast = 12, slow = 26, sig = 9): MACDResult {
  const ef = calcEMA(closes, fast);
  const es = calcEMA(closes, slow);
  const macd: (number | null)[] = closes.map((_, i) =>
    ef[i] !== null && es[i] !== null ? (ef[i] as number) - (es[i] as number) : null,
  );
  const macdVals: number[] = [];
  const macdIdx: number[] = [];
  for (let i = 0; i < macd.length; i++) {
    if (macd[i] !== null) { macdVals.push(macd[i] as number); macdIdx.push(i); }
  }
  const sigRaw = calcEMA(macdVals, sig);
  const signal: (number | null)[] = new Array(closes.length).fill(null);
  const hist: (number | null)[] = new Array(closes.length).fill(null);
  sigRaw.forEach((v, j) => {
    if (v !== null) {
      const oi = macdIdx[j];
      signal[oi] = v;
      hist[oi] = (macd[oi] as number) - v;
    }
  });
  return { macd, signal, hist };
}

// ─────────────────────────────────────────────────────────────────────────────
// Layout
// ─────────────────────────────────────────────────────────────────────────────

interface PanelInfo { y: number; h: number; label: string }
interface Layout {
  W: number; H: number;
  chartX: number; chartY: number; chartW: number; chartH: number;
  subPanels: PanelInfo[];
  xAxisY: number;
}

function buildLayout(W: number, H: number, vis: IndicatorVisibility): Layout {
  const panels: PanelInfo[] = [];
  const activeSubs: string[] = [];
  if (vis.volume) activeSubs.push('Volume');
  if (vis.macd) activeSubs.push('MACD');
  if (vis.rsi) activeSubs.push('RSI');

  const totalSubH = activeSubs.length * (SUB_PANEL_HEIGHT + 1);
  const mainH = H - X_AXIS_HEIGHT - totalSubH;
  let cursor = mainH;
  for (const lbl of activeSubs) {
    panels.push({ y: cursor, h: SUB_PANEL_HEIGHT, label: lbl });
    cursor += SUB_PANEL_HEIGHT + 1;
  }
  return {
    W, H,
    chartX: 0, chartY: 0,
    chartW: W - Y_AXIS_WIDTH,
    chartH: mainH,
    subPanels: panels,
    xAxisY: H - X_AXIS_HEIGHT,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Tiny utilities
// ─────────────────────────────────────────────────────────────────────────────

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function nicePrice(v: number): string {
  if (!isFinite(v)) return '—';
  if (Math.abs(v) >= 1000) return v.toFixed(2);
  if (Math.abs(v) >= 1) return v.toFixed(4);
  if (Math.abs(v) >= 0.001) return v.toFixed(6);
  return v.toFixed(8);
}

function fmtVol(v: number): string {
  if (v >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toFixed(0);
}

function dateShort(ts: number, tf: Timeframe): string {
  const d = new Date(ts);
  if (tf === '1M') return d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
  if (tf === '1W' || tf === '1D') return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
}

function dateFull(ts: number, tf: Timeframe): string {
  const d = new Date(ts);
  const date = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  if (tf === '1D' || tf === '1W' || tf === '1M') return date;
  const time = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} ${time}`;
}

function pToY(price: number, minP: number, maxP: number, top: number, h: number): number {
  if (maxP === minP) return top + h / 2;
  return top + ((maxP - price) / (maxP - minP)) * h;
}

function vToY(val: number, minV: number, maxV: number, top: number, h: number): number {
  if (maxV === minV) return top + h / 2;
  return top + ((maxV - val) / (maxV - minV)) * h;
}

function cxOf(i: number, slotW: number, chartX: number): number {
  return chartX + i * slotW + slotW / 2;
}

function rrect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

// ─────────────────────────────────────────────────────────────────────────────
// Indicator pills config
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_IND: IndicatorVisibility = {
  sma20: true, sma50: true, ema12: false, ema26: false,
  bb: true, rsi: true, macd: true, volume: true,
};

const PILLS: { key: keyof IndicatorVisibility; label: string; color: string }[] = [
  { key: 'sma20',   label: 'SMA 20',  color: THEME.sma20 },
  { key: 'sma50',   label: 'SMA 50',  color: THEME.sma50 },
  { key: 'ema12',   label: 'EMA 12',  color: THEME.ema12 },
  { key: 'ema26',   label: 'EMA 26',  color: THEME.ema26 },
  { key: 'bb',      label: 'BB',      color: THEME.bbUpper },
  { key: 'rsi',     label: 'RSI',     color: THEME.rsiLine },
  { key: 'macd',    label: 'MACD',    color: THEME.macdLine },
  { key: 'volume',  label: 'Vol',     color: THEME.volumePos },
];

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function ProfessionalChart({ symbol, height = 520 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mainCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const rafOverlayRef = useRef<number>(0);

  const [timeframe, setTimeframe] = useState<Timeframe>('1H');
  const [indicators, setIndicators] = useState<IndicatorVisibility>(DEFAULT_IND);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canvasW, setCanvasW] = useState(800);

  const crosshairPos = useRef<{ x: number; y: number } | null>(null);
  const hoveredIdx = useRef<number>(-1);

  // ── Fetch ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true);
    setError(null);
    const ctrl = new AbortController();
    fetch(`/api/v1/ohlcv/${encodeURIComponent(symbol)}?tf=${timeframe.toLowerCase()}`, {
      signal: ctrl.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<OHLCVResponse>;
      })
      .then((data) => {
        if (!Array.isArray(data.candles) || data.candles.length === 0)
          throw new Error('No candle data received');
        setCandles(data.candles);
        setLoading(false);
      })
      .catch((e) => {
        if (e.name === 'AbortError') return;
        setError(e.message ?? 'Failed to load chart data');
        setLoading(false);
      });
    return () => ctrl.abort();
  }, [symbol, timeframe]);

  // ── ResizeObserver ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0].contentRect.width);
      if (w > 0) setCanvasW(w);
    });
    ro.observe(containerRef.current);
    const w = Math.floor(containerRef.current.getBoundingClientRect().width);
    if (w > 0) setCanvasW(w);
    return () => ro.disconnect();
  }, []);

  // ── Computed indicators ───────────────────────────────────────────────────

  const computed = useMemo(() => {
    if (!candles.length) return null;
    const closes = candles.map((c) => c.c);
    return {
      sma20: calcSMA(closes, 20),
      sma50: calcSMA(closes, 50),
      ema12: calcEMA(closes, 12),
      ema26: calcEMA(closes, 26),
      bb: calcBB(closes),
      rsi: calcRSI(closes, 14),
      macd: calcMACD(closes),
    };
  }, [candles]);

  // ── Layout ────────────────────────────────────────────────────────────────

  const layout = useMemo(
    () => buildLayout(canvasW, height, indicators),
    [canvasW, height, indicators],
  );

  // ── Prepare canvas (DPR-aware) ────────────────────────────────────────────

  function prepCanvas(
    canvas: HTMLCanvasElement,
    w: number,
    h: number,
    dpr: number,
  ): CanvasRenderingContext2D | null {
    const cw = Math.round(w * dpr);
    const ch = Math.round(h * dpr);
    if (canvas.width !== cw || canvas.height !== ch) {
      canvas.width = cw;
      canvas.height = ch;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return ctx;
  }

  // ── Main chart draw ───────────────────────────────────────────────────────

  const drawMain = useCallback(() => {
    const canvas = mainCanvasRef.current;
    if (!canvas || !candles.length || !computed) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = prepCanvas(canvas, canvasW, height, dpr);
    if (!ctx) return;

    const { W, H, chartX, chartY, chartW, chartH, subPanels, xAxisY } = layout;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = THEME.bg;
    ctx.fillRect(0, 0, W, H);

    const n = candles.length;
    const slotW = clamp(chartW / n, MIN_CANDLE_WIDTH, MAX_CANDLE_WIDTH);
    const visible = Math.floor(chartW / slotW);
    const startIdx = Math.max(0, n - visible);
    const vis = candles.slice(startIdx);
    const vc = vis.length;

    // Price range
    let minP = Infinity, maxP = -Infinity;
    for (const c of vis) { if (c.l < minP) minP = c.l; if (c.h > maxP) maxP = c.h; }
    const pad = (maxP - minP) * 0.08;
    minP -= pad; maxP += pad;

    // ── Grid ────────────────────────────────────────────────────────────────
    ctx.strokeStyle = THEME.gridLine;
    ctx.lineWidth = 1;
    const gs = 6;
    for (let i = 0; i <= gs; i++) {
      const y = chartY + (i / gs) * chartH;
      ctx.beginPath(); ctx.moveTo(chartX, y); ctx.lineTo(chartX + chartW, y); ctx.stroke();
    }

    // ── Bollinger Bands ──────────────────────────────────────────────────────
    if (indicators.bb) {
      const { upper, lower, mid } = computed.bb;

      // Fill
      ctx.beginPath();
      let began = false;
      for (let i = 0; i < vc; i++) {
        const ai = startIdx + i;
        if (upper[ai] === null) continue;
        const cx = cxOf(i, slotW, chartX);
        const y = pToY(upper[ai] as number, minP, maxP, chartY, chartH);
        if (!began) { ctx.moveTo(cx, y); began = true; } else ctx.lineTo(cx, y);
      }
      for (let i = vc - 1; i >= 0; i--) {
        const ai = startIdx + i;
        if (lower[ai] === null) continue;
        ctx.lineTo(cxOf(i, slotW, chartX), pToY(lower[ai] as number, minP, maxP, chartY, chartH));
      }
      ctx.closePath();
      ctx.fillStyle = THEME.bbFill;
      ctx.fill();

      // Lines
      const drawLine = (arr: (number | null)[], color: string, lw = 1) => {
        ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = 'round';
        let moved = false;
        for (let i = 0; i < vc; i++) {
          const ai = startIdx + i;
          if (arr[ai] === null) { moved = false; continue; }
          const cx = cxOf(i, slotW, chartX);
          const y = pToY(arr[ai] as number, minP, maxP, chartY, chartH);
          if (!moved) { ctx.moveTo(cx, y); moved = true; } else ctx.lineTo(cx, y);
        }
        ctx.stroke();
      };
      drawLine(upper, THEME.bbUpper);
      drawLine(lower, THEME.bbLower);
      drawLine(mid, THEME.bbMid);
    }

    // ── Overlay lines helper ─────────────────────────────────────────────────
    const overlayLine = (arr: (number | null)[], color: string, lw = 1.5) => {
      ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineJoin = 'round';
      let moved = false;
      for (let i = 0; i < vc; i++) {
        const ai = startIdx + i;
        if (arr[ai] === null) { moved = false; continue; }
        const cx = cxOf(i, slotW, chartX);
        const y = pToY(arr[ai] as number, minP, maxP, chartY, chartH);
        if (!moved) { ctx.moveTo(cx, y); moved = true; } else ctx.lineTo(cx, y);
      }
      ctx.stroke();
    };
    if (indicators.sma20) overlayLine(computed.sma20, THEME.sma20);
    if (indicators.sma50) overlayLine(computed.sma50, THEME.sma50);
    if (indicators.ema12) overlayLine(computed.ema12, THEME.ema12);
    if (indicators.ema26) overlayLine(computed.ema26, THEME.ema26);

    // ── Close gradient fill ──────────────────────────────────────────────────
    {
      const grad = ctx.createLinearGradient(0, chartY, 0, chartY + chartH);
      grad.addColorStop(0, 'rgba(16,185,129,0.10)');
      grad.addColorStop(1, 'rgba(16,185,129,0.00)');
      ctx.beginPath();
      let moved = false;
      for (let i = 0; i < vc; i++) {
        const cx = cxOf(i, slotW, chartX);
        const y = pToY(vis[i].c, minP, maxP, chartY, chartH);
        if (!moved) { ctx.moveTo(cx, y); moved = true; } else ctx.lineTo(cx, y);
      }
      if (vc > 0) {
        ctx.lineTo(cxOf(vc - 1, slotW, chartX), chartY + chartH);
        ctx.lineTo(cxOf(0, slotW, chartX), chartY + chartH);
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      }
    }

    // ── Candles ──────────────────────────────────────────────────────────────
    for (let i = 0; i < vc; i++) {
      const c = vis[i];
      const bull = c.c >= c.o;
      const color = bull ? THEME.candleGreen : THEME.candleRed;
      const cx = cxOf(i, slotW, chartX);
      const bw = Math.max(1, slotW * (1 - CANDLE_GAP_RATIO));

      const oY = pToY(c.o, minP, maxP, chartY, chartH);
      const cY = pToY(c.c, minP, maxP, chartY, chartH);
      const hY = pToY(c.h, minP, maxP, chartY, chartH);
      const lY = pToY(c.l, minP, maxP, chartY, chartH);

      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(cx, hY); ctx.lineTo(cx, lY); ctx.stroke();

      ctx.fillStyle = color;
      ctx.fillRect(cx - bw / 2, Math.min(oY, cY), bw, Math.max(1, Math.abs(cY - oY)));
    }

    // ── Last price dashed line ────────────────────────────────────────────────
    {
      const lastC = candles[candles.length - 1].c;
      const ly = pToY(lastC, minP, maxP, chartY, chartH);
      if (ly >= chartY && ly <= chartY + chartH) {
        ctx.save();
        ctx.strokeStyle = THEME.lastPrice;
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(chartX, ly); ctx.lineTo(chartX + chartW, ly); ctx.stroke();
        ctx.setLineDash([]);

        const lbl = nicePrice(lastC);
        const lw = 68, lh = 18;
        const lx = chartX + chartW + 2;
        ctx.fillStyle = THEME.lastPrice;
        rrect(ctx, lx, ly - lh / 2, lw, lh, 3);
        ctx.fill();
        ctx.fillStyle = THEME.bg;
        ctx.font = `bold 10px ${THEME.fontMono}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(lbl, lx + lw / 2, ly);
        ctx.restore();
      }
    }

    // ── Y-axis labels ─────────────────────────────────────────────────────────
    ctx.font = `10px ${THEME.fontMono}`;
    ctx.fillStyle = THEME.textSecondary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    for (let i = 0; i <= 6; i++) {
      const price = maxP - (i / 6) * (maxP - minP);
      const y = chartY + (i / 6) * chartH;
      ctx.fillText(nicePrice(price), chartX + chartW + 4, y);
    }

    // ── X-axis labels ─────────────────────────────────────────────────────────
    ctx.font = `10px ${THEME.fontSans}`;
    ctx.fillStyle = THEME.textTertiary;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const xTarget = Math.max(3, Math.floor(chartW / 100));
    const xStep = Math.max(1, Math.floor(vc / xTarget));
    for (let i = 0; i < vc; i += xStep) {
      ctx.fillText(dateShort(vis[i].t, timeframe), cxOf(i, slotW, chartX), xAxisY + 4);
    }

    // ── Sub panels ────────────────────────────────────────────────────────────
    for (const panel of subPanels) {
      const { y: pY, h: pH, label } = panel;

      // Divider
      ctx.strokeStyle = THEME.panelDivider;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, pY); ctx.lineTo(W, pY); ctx.stroke();

      // Panel bg
      ctx.fillStyle = 'rgba(0,0,0,0.12)';
      ctx.fillRect(0, pY, W, pH);

      // Panel label
      ctx.font = `10px ${THEME.fontSans}`;
      ctx.fillStyle = THEME.textTertiary;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(label, 6, pY + 5);

      if (label === 'RSI') {
        const rsi = computed.rsi.values;
        const toY = (v: number) => vToY(v, 0, 100, pY, pH);

        // Bands
        for (const [level, color] of [[70, 'rgba(239,68,68,0.25)'], [30, 'rgba(16,185,129,0.25)']] as [number, string][]) {
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(chartX, toY(level)); ctx.lineTo(chartX + chartW, toY(level)); ctx.stroke();
        }
        ctx.setLineDash([]);

        // Overbought fill
        ctx.fillStyle = 'rgba(239,68,68,0.04)';
        ctx.fillRect(chartX, toY(100), chartW, toY(70) - toY(100));
        ctx.fillStyle = 'rgba(16,185,129,0.04)';
        ctx.fillRect(chartX, toY(30), chartW, toY(0) - toY(30));

        // RSI line
        ctx.beginPath(); ctx.strokeStyle = THEME.rsiLine; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
        let moved = false;
        for (let i = 0; i < vc; i++) {
          const ai = startIdx + i;
          if (rsi[ai] === null) { moved = false; continue; }
          const cx = cxOf(i, slotW, chartX);
          const y = toY(rsi[ai] as number);
          if (!moved) { ctx.moveTo(cx, y); moved = true; } else ctx.lineTo(cx, y);
        }
        ctx.stroke();

        // RSI labels
        ctx.font = `9px ${THEME.fontMono}`;
        ctx.fillStyle = THEME.textTertiary;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        for (const v of [30, 50, 70]) ctx.fillText(String(v), chartX + chartW + 4, toY(v));
      }

      if (label === 'MACD') {
        const { macd: mv, signal: sv, hist: hv } = computed.macd;
        const all: number[] = [];
        for (let i = 0; i < vc; i++) {
          const ai = startIdx + i;
          if (mv[ai] !== null) all.push(mv[ai] as number);
          if (sv[ai] !== null) all.push(sv[ai] as number);
          if (hv[ai] !== null) all.push(hv[ai] as number);
        }
        if (!all.length) continue;
        const mn = Math.min(...all), mx = Math.max(...all);
        const mp = (mx - mn) * 0.1;
        const toY = (v: number) => vToY(v, mn - mp, mx + mp, pY, pH);
        const z0 = toY(0);

        // Zero line
        ctx.strokeStyle = THEME.gridLine;
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(chartX, z0); ctx.lineTo(chartX + chartW, z0); ctx.stroke();

        // Histogram
        const hw = Math.max(1, slotW * 0.6);
        for (let i = 0; i < vc; i++) {
          const ai = startIdx + i;
          if (hv[ai] === null) continue;
          const v = hv[ai] as number;
          const cx = cxOf(i, slotW, chartX);
          const barY = toY(v);
          ctx.fillStyle = v >= 0 ? THEME.macdHistPos : THEME.macdHistNeg;
          ctx.fillRect(cx - hw / 2, Math.min(barY, z0), hw, Math.abs(barY - z0) || 1);
        }

        // MACD + signal lines
        const drawSubLine = (arr: (number | null)[], color: string) => {
          ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.lineJoin = 'round';
          let moved = false;
          for (let i = 0; i < vc; i++) {
            const ai = startIdx + i;
            if (arr[ai] === null) { moved = false; continue; }
            const cx = cxOf(i, slotW, chartX);
            const y = toY(arr[ai] as number);
            if (!moved) { ctx.moveTo(cx, y); moved = true; } else ctx.lineTo(cx, y);
          }
          ctx.stroke();
        };
        drawSubLine(mv, THEME.macdLine);
        drawSubLine(sv, THEME.signalLine);
      }

      if (label === 'Volume') {
        const maxV = Math.max(...vis.map((c) => c.v), 1);
        const toY = (v: number) => vToY(v, 0, maxV * 1.1, pY, pH);
        const bw = Math.max(1, slotW * (1 - CANDLE_GAP_RATIO));
        for (let i = 0; i < vc; i++) {
          const c = vis[i];
          const cx = cxOf(i, slotW, chartX);
          ctx.fillStyle = c.c >= c.o ? THEME.volumePos : THEME.volumeNeg;
          const by = toY(c.v);
          ctx.fillRect(cx - bw / 2, by, bw, (pY + pH) - by);
        }
        ctx.font = `9px ${THEME.fontMono}`;
        ctx.fillStyle = THEME.textTertiary;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(fmtVol(maxV), chartX + chartW + 4, pY + 5);
      }
    }
  }, [candles, computed, layout, indicators, canvasW, height, timeframe]);

  // ── Overlay / crosshair draw ───────────────────────────────────────────────

  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const ctx = prepCanvas(canvas, canvasW, height, dpr);
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasW, height);

    const pos = crosshairPos.current;
    if (!pos || !candles.length || !computed) return;

    const { chartX, chartY, chartW, chartH, xAxisY } = layout;
    const n = candles.length;
    const slotW = clamp(chartW / n, MIN_CANDLE_WIDTH, MAX_CANDLE_WIDTH);
    const visible = Math.floor(chartW / slotW);
    const startIdx = Math.max(0, n - visible);
    const vis = candles.slice(startIdx);
    const vc = vis.length;

    let minP = Infinity, maxP = -Infinity;
    for (const c of vis) { if (c.l < minP) minP = c.l; if (c.h > maxP) maxP = c.h; }
    const pad = (maxP - minP) * 0.08;
    minP -= pad; maxP += pad;

    const rawIdx = Math.floor((pos.x - chartX) / slotW);
    const idx = clamp(rawIdx, 0, vc - 1);
    hoveredIdx.current = idx;
    const cx = cxOf(idx, slotW, chartX);

    // Crosshair lines
    ctx.strokeStyle = THEME.crosshair;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 3]);

    ctx.beginPath(); ctx.moveTo(cx, chartY); ctx.lineTo(cx, xAxisY); ctx.stroke();

    if (pos.y >= chartY && pos.y <= chartY + chartH) {
      ctx.beginPath(); ctx.moveTo(chartX, pos.y); ctx.lineTo(chartX + chartW, pos.y); ctx.stroke();

      // Horizontal price label
      const hp = maxP - ((pos.y - chartY) / chartH) * (maxP - minP);
      const lw = 68, lh = 18, lx = chartX + chartW + 2;
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      rrect(ctx, lx, pos.y - lh / 2, lw, lh, 3); ctx.fill();
      ctx.font = `10px ${THEME.fontMono}`;
      ctx.fillStyle = THEME.textPrimary;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(nicePrice(hp), lx + lw / 2, pos.y);
    }
    ctx.setLineDash([]);

    // OHLCV tooltip
    if (idx >= 0 && idx < vc) {
      const c = vis[idx];
      drawCandleTooltip(ctx, c, pos.x, pos.y, canvasW, height, chartX, chartY, chartH);
    }

    // Date label on x-axis
    if (idx >= 0 && idx < vc) {
      const txt = dateFull(vis[idx].t, timeframe);
      const tw = Math.min(200, txt.length * 7.2 + 16), th = 18;
      let lx = cx - tw / 2;
      lx = clamp(lx, chartX, chartX + chartW - tw);
      const ly = xAxisY + 2;
      ctx.fillStyle = 'rgba(255,255,255,0.09)';
      rrect(ctx, lx, ly, tw, th, 3); ctx.fill();
      ctx.font = `10px ${THEME.fontSans}`;
      ctx.fillStyle = THEME.textSecondary;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(txt, lx + tw / 2, ly + th / 2);
    }
  }, [candles, computed, layout, canvasW, height, timeframe]);

  // ── Schedule redraws ───────────────────────────────────────────────────────

  useEffect(() => {
    rafRef.current = requestAnimationFrame(drawMain);
    return () => cancelAnimationFrame(rafRef.current);
  }, [drawMain]);

  useEffect(() => {
    rafOverlayRef.current = requestAnimationFrame(drawOverlay);
    return () => cancelAnimationFrame(rafOverlayRef.current);
  }, [drawOverlay]);

  // ── Pointer events ─────────────────────────────────────────────────────────

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const r = overlayCanvasRef.current?.getBoundingClientRect();
      if (!r) return;
      crosshairPos.current = { x: e.clientX - r.left, y: e.clientY - r.top };
      cancelAnimationFrame(rafOverlayRef.current);
      rafOverlayRef.current = requestAnimationFrame(drawOverlay);
    },
    [drawOverlay],
  );

  const onPointerLeave = useCallback(() => {
    crosshairPos.current = null;
    hoveredIdx.current = -1;
    const canvas = overlayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  // Touch (non-passive)
  useEffect(() => {
    const el = overlayCanvasRef.current;
    if (!el) return;
    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      const t = e.touches[0];
      crosshairPos.current = { x: t.clientX - r.left, y: t.clientY - r.top };
      cancelAnimationFrame(rafOverlayRef.current);
      rafOverlayRef.current = requestAnimationFrame(drawOverlay);
    };
    const onTouchEnd = () => {
      crosshairPos.current = null;
      const ctx = el.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, el.width, el.height);
    };
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [drawOverlay]);

  // ── Toggle indicator ───────────────────────────────────────────────────────

  const toggleInd = useCallback((key: keyof IndicatorVisibility) => {
    setIndicators((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  // ── Derived display values ─────────────────────────────────────────────────

  const lastCandle = candles.length > 0 ? candles[candles.length - 1] : null;
  const prevCandle = candles.length > 1 ? candles[candles.length - 2] : null;
  const pctChange = lastCandle && prevCandle
    ? ((lastCandle.c - prevCandle.c) / prevCandle.c) * 100
    : 0;
  const isUp = pctChange >= 0;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        background: THEME.containerBg,
        borderRadius: 12,
        border: `1px solid ${THEME.border}`,
        overflow: 'hidden',
        width: '100%',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        minWidth: 320,
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 8,
          padding: '10px 14px 8px',
          borderBottom: `1px solid ${THEME.border}`,
        }}
      >
        {/* Symbol + live price */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: THEME.fontMono,
              fontSize: 15,
              fontWeight: 700,
              color: THEME.textPrimary,
              letterSpacing: '0.02em',
            }}
          >
            {symbol}
          </span>
          {lastCandle && (
            <>
              <span
                style={{
                  fontFamily: THEME.fontMono,
                  fontSize: 14,
                  fontWeight: 600,
                  color: isUp ? THEME.candleGreen : THEME.candleRed,
                }}
              >
                {nicePrice(lastCandle.c)}
              </span>
              <span
                style={{
                  fontFamily: THEME.fontMono,
                  fontSize: 11,
                  fontWeight: 500,
                  color: isUp ? 'rgba(16,185,129,0.85)' : 'rgba(239,68,68,0.85)',
                  background: isUp ? 'rgba(16,185,129,0.10)' : 'rgba(239,68,68,0.10)',
                  border: `1px solid ${isUp ? 'rgba(16,185,129,0.20)' : 'rgba(239,68,68,0.20)'}`,
                  borderRadius: 4,
                  padding: '1px 6px',
                }}
              >
                {isUp ? '+' : ''}{pctChange.toFixed(2)}%
              </span>
            </>
          )}
        </div>

        {/* Timeframe pills */}
        <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {TF_OPTIONS.map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              style={{
                padding: '3px 8px',
                fontSize: 11,
                fontFamily: THEME.fontMono,
                fontWeight: timeframe === tf ? 700 : 400,
                borderRadius: 5,
                border: timeframe === tf
                  ? `1px solid rgba(212,175,55,0.40)`
                  : '1px solid transparent',
                background: timeframe === tf
                  ? 'rgba(212,175,55,0.14)'
                  : 'transparent',
                color: timeframe === tf ? THEME.gold : THEME.textTertiary,
                cursor: 'pointer',
                transition: 'all 0.15s',
                lineHeight: 1.5,
              }}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* ── Indicator toggle pills ─────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 5,
          padding: '6px 14px',
          borderBottom: `1px solid ${THEME.border}`,
        }}
      >
        {PILLS.map(({ key, label, color }) => {
          const active = indicators[key];
          return (
            <button
              key={key}
              onClick={() => toggleInd(key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: active ? 'rgba(255,255,255,0.055)' : 'transparent',
                border: `1px solid ${active ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.04)'}`,
                borderRadius: 20,
                padding: '2px 10px 2px 7px',
                cursor: 'pointer',
                fontSize: 11,
                fontFamily: THEME.fontSans,
                color: active ? THEME.textSecondary : THEME.textTertiary,
                transition: 'all 0.14s',
                whiteSpace: 'nowrap',
                lineHeight: 1.6,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: active ? color : 'rgba(255,255,255,0.18)',
                  flexShrink: 0,
                  transition: 'background 0.14s',
                }}
              />
              {label}
            </button>
          );
        })}
      </div>

      {/* ── Canvas container ───────────────────────────────────────────────── */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          height,
          background: THEME.bg,
          overflow: 'hidden',
        }}
      >
        <canvas
          ref={mainCanvasRef}
          style={{ position: 'absolute', top: 0, left: 0, display: 'block' }}
        />
        <canvas
          ref={overlayCanvasRef}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            display: 'block',
            cursor: 'crosshair',
            touchAction: 'none',
          }}
        />

        {/* Loading */}
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: THEME.bg,
              gap: 14,
              zIndex: 10,
            }}
          >
            <SpinnerIcon />
            <span
              style={{
                fontFamily: THEME.fontSans,
                fontSize: 12,
                color: THEME.textTertiary,
                letterSpacing: '0.02em',
              }}
            >
              Loading {symbol}…
            </span>
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: THEME.bg,
              gap: 10,
              zIndex: 10,
            }}
          >
            <ErrorIcon />
            <span
              style={{
                fontFamily: THEME.fontSans,
                fontSize: 13,
                color: 'rgba(239,68,68,0.8)',
              }}
            >
              {error}
            </span>
            <button
              onClick={() => setTimeframe((t) => t)}
              style={{
                marginTop: 4,
                background: 'rgba(239,68,68,0.10)',
                border: '1px solid rgba(239,68,68,0.22)',
                borderRadius: 6,
                color: 'rgba(239,68,68,0.85)',
                fontSize: 12,
                fontFamily: THEME.fontSans,
                padding: '5px 14px',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* ── Legend footer ──────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px 16px',
          padding: '5px 14px 6px',
          borderTop: `1px solid ${THEME.border}`,
        }}
      >
        {indicators.sma20   && <LegendItem color={THEME.sma20}    label="SMA 20" />}
        {indicators.sma50   && <LegendItem color={THEME.sma50}    label="SMA 50" />}
        {indicators.ema12   && <LegendItem color={THEME.ema12}    label="EMA 12" />}
        {indicators.ema26   && <LegendItem color={THEME.ema26}    label="EMA 26" />}
        {indicators.bb      && <LegendItem color={THEME.bbUpper}  label="Bollinger Bands (20,2)" />}
        {indicators.rsi     && <LegendItem color={THEME.rsiLine}  label="RSI (14)" />}
        {indicators.macd    && <LegendItem color={THEME.macdLine} label="MACD (12,26,9)" />}
        {indicators.volume  && <LegendItem color={THEME.volumePos}label="Volume" />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip drawing (canvas)
// ─────────────────────────────────────────────────────────────────────────────

function drawCandleTooltip(
  ctx: CanvasRenderingContext2D,
  c: Candle,
  mx: number,
  my: number,
  W: number,
  H: number,
  chartX: number,
  chartY: number,
  chartH: number,
) {
  const bull = c.c >= c.o;
  const rows = [
    { label: 'O', value: nicePrice(c.o), hl: false },
    { label: 'H', value: nicePrice(c.h), hl: false },
    { label: 'L', value: nicePrice(c.l), hl: false },
    { label: 'C', value: nicePrice(c.c), hl: true },
    { label: 'V', value: fmtVol(c.v),   hl: false },
  ];

  const padX = 10, padY = 8, rowH = 18;
  const tw = 150, th = padY * 2 + rows.length * rowH;

  let tx = mx + 16;
  let ty = my - th / 2;
  if (tx + tw > W - 4) tx = mx - tw - 16;
  if (ty < chartY + 2) ty = chartY + 2;
  if (ty + th > chartY + chartH - 2) ty = chartY + chartH - th - 2;

  // Shadow
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 5;

  ctx.fillStyle = 'rgba(17,18,27,0.97)';
  rrect(ctx, tx, ty, tw, th, 8);
  ctx.fill();

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;

  // Border
  ctx.strokeStyle = bull ? 'rgba(16,185,129,0.30)' : 'rgba(239,68,68,0.30)';
  ctx.lineWidth = 1;
  rrect(ctx, tx, ty, tw, th, 8);
  ctx.stroke();

  // Accent bar
  ctx.fillStyle = bull ? THEME.candleGreen : THEME.candleRed;
  ctx.fillRect(tx, ty + 8, 3, th - 16);

  // Rows
  for (let i = 0; i < rows.length; i++) {
    const { label, value, hl } = rows[i];
    const ry = ty + padY + i * rowH + rowH / 2;

    ctx.font = `11px ${THEME.fontSans}`;
    ctx.fillStyle = THEME.textTertiary;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, tx + padX + 6, ry);

    ctx.font = `11px ${THEME.fontMono}`;
    ctx.fillStyle = hl
      ? (bull ? THEME.candleGreen : THEME.candleRed)
      : THEME.textSecondary;
    ctx.textAlign = 'right';
    ctx.fillText(value, tx + tw - padX, ry);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Small React sub-components
// ─────────────────────────────────────────────────────────────────────────────

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
      <div
        style={{
          width: 14,
          height: 2,
          background: color,
          borderRadius: 1,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontFamily: THEME.fontSans,
          fontSize: 10,
          color: THEME.textTertiary,
        }}
      >
        {label}
      </span>
    </div>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="30"
      height="30"
      viewBox="0 0 30 30"
      style={{
        animation: 'pc-spin 0.85s linear infinite',
      }}
    >
      <style>{`@keyframes pc-spin { to { transform: rotate(360deg); } }`}</style>
      <circle
        cx="15" cy="15" r="12"
        fill="none"
        stroke="rgba(212,175,55,0.15)"
        strokeWidth="2.5"
      />
      <path
        d="M15 3 A12 12 0 0 1 27 15"
        fill="none"
        stroke={THEME.gold}
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ErrorIcon() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="rgba(239,68,68,0.55)" strokeWidth="1.5" />
      <path d="M12 7v6" stroke="rgba(239,68,68,0.85)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="12" cy="16.5" r="0.75" fill="rgba(239,68,68,0.85)" />
    </svg>
  );
}
