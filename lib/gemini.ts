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

// --- Volume & Wick analysis ---

function analyzeVolume(klines: Kline[]): string {
  const volumes = klines.map((k) => parseFloat(k.volume));
  const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const lines: string[] = [];

  // Find giant volume candles
  for (let i = Math.max(0, klines.length - 10); i < klines.length; i++) {
    const vol = volumes[i];
    const ratio = vol / avgVol;
    if (ratio >= 3) {
      const k = klines[i];
      const open = parseFloat(k.open);
      const close = parseFloat(k.close);
      const high = parseFloat(k.high);
      const low = parseFloat(k.low);
      const bodySize = Math.abs(close - open);
      const upperWick = high - Math.max(open, close);
      const lowerWick = Math.min(open, close) - low;
      const totalRange = high - low;
      const dealingPoint50 = low + totalRange / 2;
      const isBullish = close > open;
      lines.push(`Candle ${i + 1}: GIANT VOL (${ratio.toFixed(1)}x avg) | ${isBullish ? "BULLISH" : "BEARISH"} | 50% Dealing Point: $${dealingPoint50.toFixed(2)} | Upper Wick: ${((upperWick / totalRange) * 100).toFixed(0)}% | Lower Wick: ${((lowerWick / totalRange) * 100).toFixed(0)}%`);
    } else if (ratio >= 2) {
      lines.push(`Candle ${i + 1}: HIGH VOL (${ratio.toFixed(1)}x avg)`);
    }
  }

  // Recent volume trend
  const recent5 = volumes.slice(-5);
  const prev5 = volumes.slice(-10, -5);
  if (prev5.length === 5) {
    const recentAvg = recent5.reduce((a, b) => a + b, 0) / 5;
    const prevAvg = prev5.reduce((a, b) => a + b, 0) / 5;
    lines.push(`Volume Trend: ${recentAvg > prevAvg * 1.5 ? "INCREASING SIGNIFICANTLY" : recentAvg > prevAvg ? "Increasing" : recentAvg < prevAvg * 0.5 ? "DRYING UP" : "Decreasing"}`);
  }

  return lines.length > 0 ? lines.join("\n") : "No notable volume events";
}

function analyzeWicks(klines: Kline[]): string {
  const recent = klines.slice(-10);
  const lines: string[] = [];

  for (let i = 0; i < recent.length; i++) {
    const k = recent[i];
    const open = parseFloat(k.open);
    const close = parseFloat(k.close);
    const high = parseFloat(k.high);
    const low = parseFloat(k.low);
    const bodySize = Math.abs(close - open);
    const totalRange = high - low;
    if (totalRange === 0) continue;
    const upperWick = high - Math.max(open, close);
    const lowerWick = Math.min(open, close) - low;
    const upperWickPct = (upperWick / totalRange) * 100;
    const lowerWickPct = (lowerWick / totalRange) * 100;
    const bodyPct = (bodySize / totalRange) * 100;

    // Hammer / Shooting Star detection
    if (lowerWickPct > 60 && bodyPct < 30) {
      lines.push(`Candle ${klines.length - 10 + i + 1}: HAMMER (buying pressure) | Lower wick ${lowerWickPct.toFixed(0)}%`);
    } else if (upperWickPct > 60 && bodyPct < 30) {
      lines.push(`Candle ${klines.length - 10 + i + 1}: SHOOTING STAR (selling pressure) | Upper wick ${upperWickPct.toFixed(0)}%`);
    } else if (upperWickPct > 50) {
      lines.push(`Candle ${klines.length - 10 + i + 1}: Strong upper wick rejection (${upperWickPct.toFixed(0)}%) — selling pressure`);
    } else if (lowerWickPct > 50) {
      lines.push(`Candle ${klines.length - 10 + i + 1}: Strong lower wick support (${lowerWickPct.toFixed(0)}%) — buying pressure`);
    }
  }

  return lines.length > 0 ? lines.join("\n") : "No significant wick signals";
}

// --- SMA structure analysis ---

function analyzeSMAStructure(klines: Kline[]): string {
  const closes = klines.map((k) => parseFloat(k.close));
  const current = closes[closes.length - 1];
  const sma50 = calcSMA(closes, 50);
  const sma150 = calcSMA(closes, 150);
  const sma200 = calcSMA(closes, 200);

  const lines: string[] = [];
  if (sma200 !== null) lines.push(`SMA200: $${sma200.toFixed(2)} (Price ${current > sma200 ? "ABOVE ✅" : "BELOW ❌"})`);
  if (sma150 !== null) lines.push(`SMA150: $${sma150.toFixed(2)} (Price ${current > sma150 ? "ABOVE ✅" : "BELOW ❌"})`);
  if (sma50 !== null) lines.push(`SMA50: $${sma50.toFixed(2)} (Price ${current > sma50 ? "ABOVE ✅" : "BELOW ❌"})`);

  if (sma200 !== null && sma150 !== null && sma50 !== null) {
    const smaSpread200_150 = Math.abs(sma200 - sma150) / sma200 * 100;
    const smaSpread150_50 = Math.abs(sma150 - sma50) / sma150 * 100;
    lines.push(`SMA200-150 spread: ${smaSpread200_150.toFixed(2)}% ${smaSpread200_150 < 2 ? "(TIGHT — war zone / compression)" : ""}`);
    lines.push(`SMA150-50 spread: ${smaSpread150_50.toFixed(2)}%`);

    // Fair Value Gap detection
    if (sma150 !== null && sma50 !== null) {
      const gap = Math.abs(current - sma50) / sma50 * 100;
      if (gap > 10) {
        lines.push(`⚠️ FAIR VALUE GAP: Price is ${gap.toFixed(1)}% away from SMA50 — potential reversal to SMA50`);
      }
    }

    // Oversold structure: SMA200/150 close together but SMA50 far below
    if (smaSpread200_150 < 3 && sma50 < sma150 * 0.95) {
      lines.push(`⚠️ OVERSOLD STRUCTURE: SMA200/150 tight but SMA50 far below — price may revert to SMA50`);
    }
  }

  return lines.join("\n");
}

// --- War/Rest/Test phase detection ---

function detectWRTPhase(klines: Kline[]): string {
  const volumes = klines.map((k) => parseFloat(k.volume));
  const avgVol = volumes.reduce((a, b) => a + b, 0) / volumes.length;
  const recent = klines.slice(-22);
  const lines: string[] = [];

  // Find the WAR candle (ultra high volume with big range)
  let warIdx = -1;
  let warVol = 0;
  for (let i = 0; i < recent.length; i++) {
    const vol = parseFloat(recent[i].volume);
    const range = parseFloat(recent[i].high) - parseFloat(recent[i].low);
    const avgRange = recent.reduce((a, k) => a + parseFloat(k.high) - parseFloat(k.low), 0) / recent.length;
    if (vol > avgVol * 2.5 && range > avgRange * 1.5 && vol > warVol) {
      warIdx = i;
      warVol = vol;
    }
  }

  if (warIdx === -1) {
    lines.push("Phase: NO CLEAR WAR DETECTED — No ultra-high volume climax candle in recent 22 candles");
    return lines.join("\n");
  }

  const warCandle = recent[warIdx];
  const warOpen = parseFloat(warCandle.open);
  const warClose = parseFloat(warCandle.close);
  const warHigh = parseFloat(warCandle.high);
  const warLow = parseFloat(warCandle.low);
  const warIsBullish = warClose > warOpen;
  const warRange = warHigh - warLow;
  const war50pct = warLow + warRange / 2;
  const upperWick = warHigh - Math.max(warOpen, warClose);
  const lowerWick = Math.min(warOpen, warClose) - warLow;

  lines.push(`🔥 WAR CANDLE DETECTED at position ${warIdx + 1}/${recent.length}`);
  lines.push(`  ${warIsBullish ? "BULLISH" : "BEARISH"} | Vol: ${(warVol / avgVol).toFixed(1)}x avg`);
  lines.push(`  Range: $${warLow.toFixed(2)} - $${warHigh.toFixed(2)}`);
  lines.push(`  50% Dealing Point: $${war50pct.toFixed(2)}`);

  if (!warIsBullish && upperWick > warRange * 0.4) {
    lines.push(`  ⚠️ Downtrend + Big Vol + Upper Wick = Buyers fighting back → POTENTIAL REVERSAL`);
  }
  if (warIsBullish && lowerWick > warRange * 0.4) {
    lines.push(`  ⚠️ Big Vol + Lower Wick = Strong buying support`);
  }

  // Check REST phase (after war: small candles, decreasing volume)
  const candlesAfterWar = recent.length - warIdx - 1;
  if (candlesAfterWar > 0) {
    const afterWar = recent.slice(warIdx + 1);
    const afterVolumes = afterWar.map((k) => parseFloat(k.volume));
    const afterAvgVol = afterVolumes.reduce((a, b) => a + b, 0) / afterVolumes.length;
    const afterRanges = afterWar.map((k) => parseFloat(k.high) - parseFloat(k.low));
    const afterAvgRange = afterRanges.reduce((a, b) => a + b, 0) / afterRanges.length;
    const isResting = afterAvgVol < avgVol * 0.7 && afterAvgRange < warRange * 0.4;

    if (isResting) {
      lines.push(`😴 REST PHASE: ${candlesAfterWar} candles after war — small candles, volume drying up`);

      // Check TEST phase
      const lastCandle = recent[recent.length - 1];
      const lastClose = parseFloat(lastCandle.close);
      const lastLow = parseFloat(lastCandle.low);
      const lastHigh = parseFloat(lastCandle.high);
      const lastLowerWick = Math.min(parseFloat(lastCandle.open), lastClose) - lastLow;
      const lastRange = lastHigh - lastLow;
      const lastVol = parseFloat(lastCandle.volume);

      // Test: price approaches war zone with low volume
      const nearWarZone = Math.abs(lastLow - warLow) / warRange < 0.3 || Math.abs(lastLow - war50pct) / warRange < 0.2;
      if (nearWarZone && lastVol < avgVol) {
        lines.push(`🎯 TEST PHASE: Price testing war zone on LOW VOLUME`);
        if (lastLowerWick > lastRange * 0.5) {
          lines.push(`  ✅ HAMMER at test level — buying pressure confirmed`);
        }
        if (candlesAfterWar >= 22) {
          lines.push(`  📏 22+ candles since war — this is a TEST (not retest)`);
        } else {
          lines.push(`  📏 ${candlesAfterWar} candles since war — this is a RETEST (< 22 candles)`);
        }
      }
    } else {
      lines.push(`⚡ POST-WAR: Active movement continuing (not resting yet)`);
    }
  }

  return lines.join("\n");
}

// --- Retracement analysis ---

function analyzeRetracement(klines: Kline[]): string {
  const closes = klines.map((k) => parseFloat(k.close));
  const highs = klines.map((k) => parseFloat(k.high));
  const lows = klines.map((k) => parseFloat(k.low));

  // Find recent swing high and swing low
  let swingHigh = -Infinity;
  let swingLow = Infinity;
  let highIdx = 0;
  let lowIdx = 0;

  for (let i = 0; i < klines.length; i++) {
    if (highs[i] > swingHigh) { swingHigh = highs[i]; highIdx = i; }
    if (lows[i] < swingLow) { swingLow = lows[i]; lowIdx = i; }
  }

  const current = closes[closes.length - 1];
  const range = swingHigh - swingLow;
  if (range === 0) return "No clear swing range";

  // Determine if we're in uptrend retracement or downtrend retracement
  const isUptrend = highIdx > lowIdx;
  const lines: string[] = [];

  if (isUptrend) {
    const retracement = (swingHigh - current) / range * 100;
    lines.push(`Trend: UPTREND (Low → High)`);
    lines.push(`Swing Low: $${swingLow.toFixed(2)} → Swing High: $${swingHigh.toFixed(2)}`);
    lines.push(`Current Retracement: ${retracement.toFixed(1)}%`);

    if (retracement < 25) lines.push(`Level: 🟢 LIGHT retracement — trend strong`);
    else if (retracement < 50) lines.push(`Level: 🟡 NORMAL retracement — healthy pullback`);
    else if (retracement < 75) lines.push(`Level: 🟠 DEEPER CORRECTION — watch for support`);
    else lines.push(`Level: 🔴 DEEP retracement — trend may be reversing`);

    // Fibonacci levels
    lines.push(`Fib 0.382: $${(swingHigh - range * 0.382).toFixed(2)}`);
    lines.push(`Fib 0.500: $${(swingHigh - range * 0.5).toFixed(2)}`);
    lines.push(`Fib 0.618: $${(swingHigh - range * 0.618).toFixed(2)}`);
  } else {
    const retracement = (current - swingLow) / range * 100;
    lines.push(`Trend: DOWNTREND (High → Low)`);
    lines.push(`Swing High: $${swingHigh.toFixed(2)} → Swing Low: $${swingLow.toFixed(2)}`);
    lines.push(`Current Bounce: ${retracement.toFixed(1)}%`);

    if (retracement < 25) lines.push(`Level: 🔴 LIGHT bounce — downtrend strong`);
    else if (retracement < 50) lines.push(`Level: 🟡 NORMAL bounce — watch for rejection`);
    else if (retracement < 75) lines.push(`Level: 🟠 DEEPER bounce — possible reversal`);
    else lines.push(`Level: 🟢 STRONG bounce — trend may be reversing`);

    lines.push(`Fib 0.382: $${(swingLow + range * 0.382).toFixed(2)}`);
    lines.push(`Fib 0.500: $${(swingLow + range * 0.5).toFixed(2)}`);
    lines.push(`Fib 0.618: $${(swingLow + range * 0.618).toFixed(2)}`);
  }

  return lines.join("\n");
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
  const sma150 = calcSMA(closes, 150);
  const sma200 = calcSMA(closes, 200);
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
  if (sma150 !== null) lines.push(`SMA150: ${sma150.toFixed(2)} (Price ${currentPrice > sma150 ? "above" : "below"})`);
  if (sma200 !== null) lines.push(`SMA200: ${sma200.toFixed(2)} (Price ${currentPrice > sma200 ? "above" : "below"})`);
  if (ema12 !== null && ema26 !== null) lines.push(`EMA12: ${ema12.toFixed(2)}, EMA26: ${ema26.toFixed(2)} (${ema12 > ema26 ? "Bullish" : "Bearish"} cross)`);
  return lines.join("\n");
}

// --- Main analysis function ---

export async function analyzeCoin(input: AnalysisInput): Promise<string> {
  const { symbol, klines1h, klines4h, klines1d, currentPrice, high24h, low24h, volume24h, quoteVolume24h, priceChange24h } = input;

  const sr1h = findSupportResistance(klines1h);
  const sr4h = findSupportResistance(klines4h);
  const sr1d = findSupportResistance(klines1d);

  const systemPrompt = `You are an institutional swing trader and price action analyst. You trade like a sniper — patient, precise, and disciplined. You follow the MEZ "The Last Engagement" strategy (War → Rest → Test) and combine it with order flow analysis, volume reading, and strict risk management.

## YOUR IDENTITY & PHILOSOPHY
- You are an INSTITUTIONAL TRADER — you think like smart money
- You NEVER trade on emotion or FOMO — "စိတ်အထင်နဲ့ မ၀ယ်ရ"
- You NEVER chase moves — "Don't chase the move. Wait for the retest. Let the daily candle close."
- "The Trend is your best friend except at the end where it bends" — follow the trend, but detect reversals
- You always ask: Where is the order flow? Where are the buyers? Where are the sellers? Who is the loser? How to beat the loser?

## CORE ANALYSIS FRAMEWORK: PRICE ACTION + ORDER FLOW

### Step 1: Identify the Trend & Momentum
- Use SMA 200/150/50 structure:
  - SMA200 and SMA150 close together + SMA50 far away = oversold/overbought structure
  - If SMA200/150 not following price (fair value gap) = potential reversal back to SMA50
  - Price above all 3 SMAs = strong uptrend
  - Price below all 3 SMAs = strong downtrend
- The trend is determined by the DAILY timeframe (primary)
- 4H for swing direction, 1H for entry timing

### Step 2: MEZ's "The Last Engagement" (War → Rest → Test)

**THE WAR:**
- Ultra high volume candle with big range (buying climax or selling climax)
- In downtrend: big volume + upper wick = buyers fighting sellers → potential reversal
- In uptrend: big volume + lower wick = sellers fighting buyers → potential reversal
- Institutions enter during the war — SL is below/above the war candle
- The war candle becomes a key support/resistance zone
- The 50% dealing point of the war candle is critical

**THE REST:**
- After the war: small candles, volume decreasing (drying up)
- Volume နည်းသထက်နည်းရမယ် (less volume = better rest)
- This is the consolidation phase — DO NOT TRADE during rest
- Wait patiently

**THE TEST:**
- Price returns to test the war zone
- MUST see: Hammer candle, bullish engulfing, or lower wick rejection
- Volume must be LOW during the test (institutional testing, not retail panic)
- Test vs Retest rule: Test = 22+ candles after war. Retest = less than 22 candles
- The test is your SNIPER ENTRY

### Step 3: Volume & Wick Analysis

**Volume Rules:**
- Vol (volume) ကို ဘယ်နေရာမှာပေါ်လာသလဲက ပိုအရေးကြီး (WHERE volume appears matters more)
- Giant volume candle → becomes future support/resistance zone
- Giant volume candle's 50% = dealing point → if confirmation candle closes past 50%, enter at the midpoint
- Ultra high volume in downtrend with upper wick = selling climax + institutional buying → reversal likely
- Decreasing volume after big move = healthy rest/consolidation

**Wick Reading:**
- Upper wick = selling pressure / rejection at highs
- Lower wick = buying pressure / support at lows
- Hammer (long lower wick, small body) = strong buying signal at support
- Shooting star (long upper wick, small body) = strong selling signal at resistance
- In downtrend: big volume + big upper wick = buyers and sellers at war → watch for reversal

### Step 4: Retracement Levels
Classify pullbacks:
- **Light** retracement (< 25%) = trend very strong
- **Normal** retracement (25-50%) = healthy pullback, good entry zone
- **Deeper Correction** (50-75%) = caution, watch support
- Use horizontal support/resistance + Fibonacci 0.382/0.5/0.618 for entry zones

### Step 5: Potential Bear/Bull Traps
- Look for fake breakouts that trap retail traders
- The "loser" in the trap provides fuel for the real move
- Identify who got trapped and trade with the winners

## STRICT RISK MANAGEMENT RULES (NEVER VIOLATE)
1. FIRST set SL, then TP, then calculate position size, THEN entry
2. Risk per trade = 3% of capital MAXIMUM
3. Minimum Risk:Reward = 1:3
4. SL = 1R (at logical level — below support for longs, above resistance for shorts)
5. TP1 = 2R (take partial profit)
6. TP2 = trailing stop (let winner run)
7. 3 consecutive losses → STOP TRADING (reset, review, re-analyze)
8. For futures: maximum 3% SL of capital
9. NEVER enter without a written reason (the analysis IS the reason)

## EXECUTION DISCIPLINE
- Don't chase the move
- Wait for the retest
- Let the daily candle close before confirming signals
- Wait for confirmation: hammer candle, bullish/bearish engulfing, rejection wick
- No FOMO — emotion-based entries are forbidden

## OUTPUT FORMAT

### 🔍 Order Flow Analysis
- Where is the order flow? (bullish/bearish/neutral)
- Where are the buyers? (support zones with evidence)
- Where are the sellers? (resistance zones with evidence)
- Who is the loser? (trapped longs or trapped shorts?)
- How to beat the loser?

### 📊 Trend & Momentum (SMA 200/150/50)
| Timeframe | SMA Structure | Trend | Fair Value Gap? |
|-----------|--------------|-------|-----------------|
| Daily | ... | ... | ... |
| 4H | ... | ... | ... |
| 1H | ... | ... | ... |

### 🔥 War / Rest / Test Phase
Current phase detection and detailed explanation.

### 📊 Volume & Wick Reading
Key volume events, wick signals, and their meaning.

### 📐 Retracement Level
Current retracement classification and Fibonacci levels.

### 🎯 Support & Resistance
Key levels from pivot points, war zones, and dealing points.

### ⚡ SIGNAL: [BUY / SELL / HOLD / WAIT FOR TEST] — Confidence: X%
List numbered confirmations that are met or not met.

### 💰 Trade Setup (only if BUY or SELL)
- **Entry Zone:** $X - $X (with reason — e.g., "test of war zone" or "Fib 0.618 retracement")
- **Stop Loss (1R):** $X (must be at logical level)
- **Take Profit 1 (2R):** $X
- **Take Profit 2:** Trailing stop strategy (e.g., "trail below SMA50" or "trail below last swing low")
- **Risk per trade:** 3% of capital
- **Position Size formula:** Position Size = (Capital × 0.03) / |Entry - SL|

### ⚠️ Risk & Warnings
- Key risks
- What would invalidate this setup?
- Emotional reminders: "Don't chase. Wait for confirmation."

### 📝 Trade Journal Note
Write a brief note explaining WHY this entry makes sense (or why HOLD/WAIT), as if writing in a trading journal. This helps the trader stay disciplined.`;

  const dataPrompt = `Analyze ${symbol} with the following real-time data:

## Current State
- **Price:** $${currentPrice}
- **24h High:** $${high24h}
- **24h Low:** $${low24h}
- **24h Volume:** ${volume24h}
- **24h Quote Volume:** $${quoteVolume24h}
- **24h Change:** ${priceChange24h}%

## Computed Technical Indicators

${computeIndicators(klines1h, "1H")}

${computeIndicators(klines4h, "4H")}

${computeIndicators(klines1d, "1D")}

## SMA Structure Analysis (Daily)
${analyzeSMAStructure(klines1d)}

## War / Rest / Test Detection

### 1H Timeframe:
${detectWRTPhase(klines1h)}

### 4H Timeframe:
${detectWRTPhase(klines4h)}

### Daily Timeframe:
${detectWRTPhase(klines1d)}

## Volume Analysis

### 1H Volume Events:
${analyzeVolume(klines1h)}

### 4H Volume Events:
${analyzeVolume(klines4h)}

### Daily Volume Events:
${analyzeVolume(klines1d)}

## Wick / Candle Analysis (Recent 10)

### 1H Wicks:
${analyzeWicks(klines1h)}

### 4H Wicks:
${analyzeWicks(klines4h)}

### Daily Wicks:
${analyzeWicks(klines1d)}

## Retracement Analysis

### 1H:
${analyzeRetracement(klines1h)}

### 4H:
${analyzeRetracement(klines4h)}

### Daily:
${analyzeRetracement(klines1d)}

## Support & Resistance (auto-detected from pivots)
1H Supports: ${sr1h.supports.map((s) => "$" + s.toFixed(2)).join(", ") || "None found"}
1H Resistances: ${sr1h.resistances.map((r) => "$" + r.toFixed(2)).join(", ") || "None found"}
4H Supports: ${sr4h.supports.map((s) => "$" + s.toFixed(2)).join(", ") || "None found"}
4H Resistances: ${sr4h.resistances.map((r) => "$" + r.toFixed(2)).join(", ") || "None found"}
1D Supports: ${sr1d.supports.map((s) => "$" + s.toFixed(2)).join(", ") || "None found"}
1D Resistances: ${sr1d.resistances.map((r) => "$" + r.toFixed(2)).join(", ") || "None found"}

## OHLCV Data

### Hourly (last 24 candles)
${formatKlines(klines1h, 24)}

### 4-Hour (last 20 candles)
${formatKlines(klines4h, 20)}

### Daily (last 14 candles)
${formatKlines(klines1d, 14)}

Now provide your complete institutional-grade analysis following ALL your rules. Remember: no FOMO, no chasing, wait for confirmation, SL first then TP then position size.`;

  const res = await fetch(
    `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts: [{ text: dataPrompt }] }],
        generationConfig: {
          temperature: 0.2,
          topP: 0.8,
          maxOutputTokens: 8192,
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
