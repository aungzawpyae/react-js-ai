const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const GEMINI_BASE_URL =
  process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";

interface Kline {
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

interface AnalysisInput {
  symbol: string;
  klines1h: Kline[];
  klines4h: Kline[];
  klines1d: Kline[];
  currentPrice: string;
  high24h: string;
  low24h: string;
  volume24h: string;
  quoteVolume24h: string;
  priceChange24h: string;
}

// --- Technical indicator calculations ---

function calcSMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

function calcEMA(closes: number[], period: number): number | null {
  if (closes.length < period) return null;
  const k = 2 / (period + 1);
  let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < closes.length; i++) {
    ema = closes[i] * k + ema * (1 - k);
  }
  return ema;
}

function calcRSI(closes: number[], period: number = 14): number | null {
  if (closes.length < period + 1) return null;
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff;
    else avgLoss += Math.abs(diff);
  }
  avgGain /= period;
  avgLoss /= period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + (diff > 0 ? diff : 0)) / period;
    avgLoss = (avgLoss * (period - 1) + (diff < 0 ? Math.abs(diff) : 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function calcMACD(closes: number[]): { macd: number; signal: number; histogram: number } | null {
  if (closes.length < 26) return null;
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  if (ema12 === null || ema26 === null) return null;
  const macd = ema12 - ema26;
  // Simplified signal line
  const macdValues: number[] = [];
  const k12 = 2 / 13;
  const k26 = 2 / 27;
  let e12 = closes.slice(0, 12).reduce((a, b) => a + b, 0) / 12;
  let e26 = closes.slice(0, 26).reduce((a, b) => a + b, 0) / 26;
  for (let i = 26; i < closes.length; i++) {
    e12 = closes[i] * k12 + e12 * (1 - k12);
    e26 = closes[i] * k26 + e26 * (1 - k26);
    macdValues.push(e12 - e26);
  }
  const signal = macdValues.length >= 9
    ? (() => {
        let s = macdValues.slice(0, 9).reduce((a, b) => a + b, 0) / 9;
        const ks = 2 / 10;
        for (let i = 9; i < macdValues.length; i++) {
          s = macdValues[i] * ks + s * (1 - ks);
        }
        return s;
      })()
    : 0;
  return { macd, signal, histogram: macd - signal };
}

function calcBollingerBands(closes: number[], period: number = 20): { upper: number; middle: number; lower: number } | null {
  if (closes.length < period) return null;
  const slice = closes.slice(-period);
  const middle = slice.reduce((a, b) => a + b, 0) / period;
  const variance = slice.reduce((a, b) => a + (b - middle) ** 2, 0) / period;
  const std = Math.sqrt(variance);
  return { upper: middle + 2 * std, middle, lower: middle - 2 * std };
}

function calcATR(klines: Kline[], period: number = 14): number | null {
  if (klines.length < period + 1) return null;
  const trs: number[] = [];
  for (let i = 1; i < klines.length; i++) {
    const h = parseFloat(klines[i].high);
    const l = parseFloat(klines[i].low);
    const pc = parseFloat(klines[i - 1].close);
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  let atr = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < trs.length; i++) {
    atr = (atr * (period - 1) + trs[i]) / period;
  }
  return atr;
}

function findSupportResistance(klines: Kline[]): { supports: number[]; resistances: number[] } {
  const highs = klines.map((k) => parseFloat(k.high));
  const lows = klines.map((k) => parseFloat(k.low));
  const closes = klines.map((k) => parseFloat(k.close));
  const current = closes[closes.length - 1];

  // Find local pivots
  const levels: number[] = [];
  for (let i = 2; i < klines.length - 2; i++) {
    if (highs[i] > highs[i - 1] && highs[i] > highs[i - 2] && highs[i] > highs[i + 1] && highs[i] > highs[i + 2]) {
      levels.push(highs[i]);
    }
    if (lows[i] < lows[i - 1] && lows[i] < lows[i - 2] && lows[i] < lows[i + 1] && lows[i] < lows[i + 2]) {
      levels.push(lows[i]);
    }
  }

  const supports = levels.filter((l) => l < current).sort((a, b) => b - a).slice(0, 3);
  const resistances = levels.filter((l) => l > current).sort((a, b) => a - b).slice(0, 3);
  return { supports, resistances };
}

function formatKlines(klines: Kline[], count: number): string {
  return klines
    .slice(-count)
    .map(
      (k, i) =>
        `${i + 1}. O:${parseFloat(k.open).toFixed(2)} H:${parseFloat(k.high).toFixed(2)} L:${parseFloat(k.low).toFixed(2)} C:${parseFloat(k.close).toFixed(2)} V:${parseFloat(k.volume).toFixed(2)}`
    )
    .join("\n");
}

function computeIndicators(klines: Kline[], label: string): string {
  const closes = klines.map((k) => parseFloat(k.close));
  const rsi = calcRSI(closes);
  const macd = calcMACD(closes);
  const bb = calcBollingerBands(closes);
  const atr = calcATR(klines);
  const sma20 = calcSMA(closes, 20);
  const sma50 = calcSMA(closes, 50);
  const ema12 = calcEMA(closes, 12);
  const ema26 = calcEMA(closes, 26);
  const currentPrice = closes[closes.length - 1];

  const lines = [`[${label} Indicators]`];
  if (rsi !== null) lines.push(`RSI(14): ${rsi.toFixed(2)}`);
  if (macd) lines.push(`MACD: ${macd.macd.toFixed(4)}, Signal: ${macd.signal.toFixed(4)}, Histogram: ${macd.histogram.toFixed(4)}`);
  if (bb) lines.push(`Bollinger Bands: Upper=${bb.upper.toFixed(2)}, Middle=${bb.middle.toFixed(2)}, Lower=${bb.lower.toFixed(2)}`);
  if (atr !== null) lines.push(`ATR(14): ${atr.toFixed(4)}`);
  if (sma20 !== null) lines.push(`SMA20: ${sma20.toFixed(2)} (Price ${currentPrice > sma20 ? "above" : "below"})`);
  if (sma50 !== null) lines.push(`SMA50: ${sma50.toFixed(2)} (Price ${currentPrice > sma50 ? "above" : "below"})`);
  if (ema12 !== null && ema26 !== null) lines.push(`EMA12: ${ema12.toFixed(2)}, EMA26: ${ema26.toFixed(2)} (${ema12 > ema26 ? "Bullish" : "Bearish"} cross)`);
  return lines.join("\n");
}

// --- Main analysis function ---

export async function analyzeCoin(input: AnalysisInput): Promise<string> {
  const { symbol, klines1h, klines4h, klines1d, currentPrice, high24h, low24h, volume24h, quoteVolume24h, priceChange24h } = input;

  const sr1h = findSupportResistance(klines1h);
  const sr1d = findSupportResistance(klines1d);

  const systemPrompt = `You are a senior crypto trading analyst with 15+ years of experience in technical analysis, market microstructure, and risk management. You combine multiple analysis frameworks to provide institutional-grade analysis.

## YOUR ANALYSIS RULES

### Entry Rules
- NEVER recommend BUY when RSI > 70 (overbought) unless strong bullish divergence exists
- NEVER recommend SELL when RSI < 30 (oversold) unless strong bearish divergence exists
- BUY signals require at least 3 of these confirmations:
  1. Price above EMA12 AND EMA12 above EMA26
  2. RSI between 40-65 and rising
  3. MACD histogram positive or crossing above signal line
  4. Price bouncing off support level or Bollinger lower band
  5. Volume increasing on up-moves
  6. Higher timeframe (4h/1d) trend alignment
- SELL signals require at least 3 of these confirmations:
  1. Price below EMA12 AND EMA12 below EMA26
  2. RSI between 35-60 and falling
  3. MACD histogram negative or crossing below signal line
  4. Price rejected at resistance or Bollinger upper band
  5. Volume increasing on down-moves
  6. Higher timeframe (4h/1d) trend alignment

### Risk Management Rules
- Stop-loss MUST be placed at a logical level (below support for longs, above resistance for shorts)
- Risk-reward ratio must be at least 1:2
- ATR-based stop: 1.5x ATR below entry for longs, 1.5x ATR above for shorts
- Position sizing: never risk more than 1-2% of portfolio per trade
- If price is in the middle of Bollinger Bands with no clear direction = HOLD

### Multi-Timeframe Rules
- Daily trend determines overall bias (primary trend)
- 4h trend determines swing direction (secondary trend)
- 1h trend determines entry timing (entry trigger)
- NEVER trade against the daily trend unless clear reversal pattern
- Best entries: 1h pullback in the direction of 4h/1d trend

### Pattern Recognition
- Look for: double tops/bottoms, head & shoulders, triangles, wedges, flags
- Candlestick patterns: engulfing, doji, hammer, shooting star, morning/evening star
- Volume confirmation required for all pattern breakouts

### Market Context
- Consider if price is at round psychological levels
- Note if price is in a range or trending
- Flag any divergences between price and indicators

## OUTPUT FORMAT
Structure your analysis exactly as follows:

### 📊 Market Overview
Brief 2-3 sentence summary of current market state.

### 📈 Multi-Timeframe Trend
| Timeframe | Trend | Strength | Key Level |
|-----------|-------|----------|-----------|
| Daily | ... | ... | ... |
| 4H | ... | ... | ... |
| 1H | ... | ... | ... |

### 🔧 Technical Indicators
Summary of RSI, MACD, Bollinger, moving averages with interpretation.

### 🎯 Support & Resistance
Key levels with explanations.

### 📐 Chart Patterns
Any patterns detected.

### ⚡ SIGNAL: [BUY/SELL/HOLD] — Confidence: [Low/Medium/High] (X%)
Reasoning with numbered confirmations that are met.

### 💰 Trade Setup (only if BUY or SELL)
- **Entry Zone:** $X - $X
- **Stop Loss:** $X (reason)
- **Take Profit 1:** $X (risk:reward)
- **Take Profit 2:** $X (risk:reward)
- **Position Size:** 1-2% portfolio risk

### ⚠️ Risk Factors
Numbered list of risks.

### 📝 Summary
One paragraph actionable conclusion.`;

  const dataPrompt = `Analyze ${symbol} with the following real-time data:

## Current State
- **Price:** $${currentPrice}
- **24h High:** $${high24h}
- **24h Low:** $${low24h}
- **24h Volume:** ${volume24h}
- **24h Quote Volume:** $${quoteVolume24h}
- **24h Change:** ${priceChange24h}%

## Computed Indicators

${computeIndicators(klines1h, "1H")}

${computeIndicators(klines4h, "4H")}

${computeIndicators(klines1d, "1D")}

## Support & Resistance (auto-detected from pivots)
1H Supports: ${sr1h.supports.map((s) => "$" + s.toFixed(2)).join(", ") || "None found"}
1H Resistances: ${sr1h.resistances.map((r) => "$" + r.toFixed(2)).join(", ") || "None found"}
1D Supports: ${sr1d.supports.map((s) => "$" + s.toFixed(2)).join(", ") || "None found"}
1D Resistances: ${sr1d.resistances.map((r) => "$" + r.toFixed(2)).join(", ") || "None found"}

## OHLCV Data

### Hourly (last 24 candles)
${formatKlines(klines1h, 24)}

### 4-Hour (last 20 candles)
${formatKlines(klines4h, 20)}

### Daily (last 14 candles)
${formatKlines(klines1d, 14)}

Now provide your complete analysis following your rules and output format.`;

  const res = await fetch(
    `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: dataPrompt }] }],
        generationConfig: {
          temperature: 0.3,
          topP: 0.8,
          maxOutputTokens: 4096,
        },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "No analysis generated.";
}
