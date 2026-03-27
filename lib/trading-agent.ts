import { placeMarketOrder } from "./binance";
import { analyzeCoin } from "./gemini";
import { supabase } from "./supabase";
import { sendTelegramMessage } from "./telegram";

// --- Configuration ---
const TRADING_COINS = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
const TOTAL_CAPITAL = 100; // $100 total capital
const RISK_PER_TRADE = 0.01; // 1% risk per trade = $1 per trade (1R)
const MAX_OPEN_TRADES = 3;
const MAX_CONSECUTIVE_LOSSES = 3;

// Binance API endpoints with fallbacks (Vercel geo-block workaround)
const BINANCE_ENDPOINTS = [
  "https://data-api.binance.vision",
  "https://api1.binance.com",
  "https://api2.binance.com",
  "https://api3.binance.com",
  "https://api.binance.com",
];

export interface TradeJournal {
  id?: string;
  symbol: string;
  side: "BUY" | "SELL";
  signal: string;
  confidence: number;
  entry_price: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number;
  quantity: number;
  risk_amount: number;
  risk_reward_ratio: string;
  status: string;
  order_id?: string;
  sl_order_id?: string;
  tp1_order_id?: string;
  tp2_order_id?: string;
  fill_price?: number;
  close_price?: number;
  pnl?: number;
  pnl_percent?: number;
  analysis_summary: string;
  ai_reasoning: string;
  timeframe: string;
  capital: number;
  created_at?: string;
  updated_at?: string;
  closed_at?: string;
}

export interface AgentResult {
  symbol: string;
  signal: string;
  confidence: number;
  action: string;
  trade?: TradeJournal;
  reason: string;
  analysis: string;
}

// --- Server-side Binance fetch with fallback endpoints ---
async function binanceFetch(path: string): Promise<Response> {
  let lastError: Error | null = null;
  for (const base of BINANCE_ENDPOINTS) {
    try {
      const res = await fetch(`${base}${path}`, {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) return res;
      lastError = new Error(`${base} returned ${res.status}`);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }
  throw new Error(`All Binance endpoints failed: ${lastError?.message}`);
}

async function fetchKlines(symbol: string, interval: string, limit: number) {
  const res = await binanceFetch(
    `/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
  );
  const data = await res.json();
  return data.map((k: (string | number)[]) => ({
    open: k[1] as string,
    high: k[2] as string,
    low: k[3] as string,
    close: k[4] as string,
    volume: k[5] as string,
  }));
}

async function fetchTicker(symbol: string) {
  const res = await binanceFetch(`/api/v3/ticker/24hr?symbol=${symbol}`);
  return res.json();
}

// --- Parse AI signal from analysis text ---
function parseSignal(analysis: string): {
  signal: string;
  confidence: number;
  entry: number;
  sl: number;
  tp1: number;
  tp2: number;
  reasoning: string;
} {
  const result = {
    signal: "HOLD",
    confidence: 0,
    entry: 0,
    sl: 0,
    tp1: 0,
    tp2: 0,
    reasoning: "",
  };

  const signalMatch = analysis.match(
    /SIGNAL:\s*\*?\*?\[?\s*(BUY|SELL|HOLD|WAIT\s*(?:FOR\s*)?(?:TEST|RETEST)?)\s*\]?\*?\*?/i
  );
  if (signalMatch) {
    result.signal = signalMatch[1].trim().toUpperCase();
  }

  const confMatch = analysis.match(/Confidence:\s*(\d+)%/i);
  if (confMatch) {
    result.confidence = parseInt(confMatch[1]);
  }

  const entryMatch = analysis.match(
    /Entry\s*(?:Zone|Price)?[:\s]*\$?([\d,]+\.?\d*)\s*[-–]\s*\$?([\d,]+\.?\d*)/i
  );
  if (entryMatch) {
    const low = parseFloat(entryMatch[1].replace(/,/g, ""));
    const high = parseFloat(entryMatch[2].replace(/,/g, ""));
    result.entry = (low + high) / 2;
  } else {
    const singleEntry = analysis.match(
      /Entry\s*(?:Zone|Price)?[:\s]*\$?([\d,]+\.?\d*)/i
    );
    if (singleEntry) {
      result.entry = parseFloat(singleEntry[1].replace(/,/g, ""));
    }
  }

  const slMatch = analysis.match(
    /Stop\s*Loss\s*(?:\(1R\))?[:\s]*\$?([\d,]+\.?\d*)/i
  );
  if (slMatch) {
    result.sl = parseFloat(slMatch[1].replace(/,/g, ""));
  }

  const tp1Match = analysis.match(
    /Take\s*Profit\s*1?\s*(?:\(2R\))?[:\s]*\$?([\d,]+\.?\d*)/i
  );
  if (tp1Match) {
    result.tp1 = parseFloat(tp1Match[1].replace(/,/g, ""));
  }

  const tp2Match = analysis.match(
    /Take\s*Profit\s*2\s*(?:\(3R\))?[:\s]*\$?([\d,]+\.?\d*)/i
  );
  if (tp2Match) {
    result.tp2 = parseFloat(tp2Match[1].replace(/,/g, ""));
  }

  const journalMatch = analysis.match(
    /Trade\s*Journal\s*Note[:\s]*([\s\S]*?)(?=###|$)/i
  );
  if (journalMatch) {
    result.reasoning = journalMatch[1].trim().slice(0, 500);
  }

  return result;
}

// --- Risk Management Checks ---
async function checkRiskManagement(): Promise<{
  canTrade: boolean;
  reason: string;
  openTrades: number;
  consecutiveLosses: number;
}> {
  const { data: openTrades } = await supabase
    .from("trading_journal")
    .select("id")
    .in("status", ["PENDING", "OPEN"]);

  const openCount = openTrades?.length || 0;

  if (openCount >= MAX_OPEN_TRADES) {
    return {
      canTrade: false,
      reason: `Max open trades reached (${openCount}/${MAX_OPEN_TRADES})`,
      openTrades: openCount,
      consecutiveLosses: 0,
    };
  }

  const { data: recentTrades } = await supabase
    .from("trading_journal")
    .select("status")
    .in("status", ["TP1_HIT", "TP2_HIT", "SL_HIT"])
    .order("closed_at", { ascending: false })
    .limit(MAX_CONSECUTIVE_LOSSES);

  let consecutiveLosses = 0;
  if (recentTrades) {
    for (const trade of recentTrades) {
      if (trade.status === "SL_HIT") consecutiveLosses++;
      else break;
    }
  }

  if (consecutiveLosses >= MAX_CONSECUTIVE_LOSSES) {
    return {
      canTrade: false,
      reason: `${MAX_CONSECUTIVE_LOSSES} consecutive losses - STOP TRADING`,
      openTrades: openCount,
      consecutiveLosses,
    };
  }

  return { canTrade: true, reason: "OK", openTrades: openCount, consecutiveLosses };
}

async function hasActiveTrade(symbol: string): Promise<boolean> {
  const { data } = await supabase
    .from("trading_journal")
    .select("id")
    .eq("symbol", symbol)
    .in("status", ["PENDING", "OPEN"])
    .limit(1);

  return (data?.length || 0) > 0;
}

function calculatePositionSize(
  entryPrice: number,
  stopLoss: number,
  capital: number
): { quantity: number; riskAmount: number } {
  const riskAmount = capital * RISK_PER_TRADE;
  const slDistance = Math.abs(entryPrice - stopLoss);
  if (slDistance === 0) return { quantity: 0, riskAmount };
  const quantity = riskAmount / slDistance;
  return { quantity, riskAmount };
}

// --- Process a single coin (fetches data server-side) ---
async function processCoin(symbol: string): Promise<AgentResult> {
  const result: AgentResult = {
    symbol,
    signal: "HOLD",
    confidence: 0,
    action: "NO_ACTION",
    reason: "",
    analysis: "",
  };

  try {
    if (await hasActiveTrade(symbol)) {
      result.action = "SKIP";
      result.reason = `Already have an active trade for ${symbol}`;
      return result;
    }

    // Fetch all market data server-side with fallback endpoints
    const [klines1h, klines4h, klines1d, ticker] = await Promise.all([
      fetchKlines(symbol, "1h", 100),
      fetchKlines(symbol, "4h", 200),
      fetchKlines(symbol, "1d", 250),
      fetchTicker(symbol),
    ]);

    const currentPrice = ticker.lastPrice || ticker.price || "0";

    // Run Gemini AI analysis
    const analysis = await analyzeCoin({
      symbol,
      klines1h,
      klines4h,
      klines1d,
      currentPrice,
      high24h: ticker.highPrice || ticker.high || "0",
      low24h: ticker.lowPrice || ticker.low || "0",
      volume24h: ticker.volume || "0",
      quoteVolume24h: ticker.quoteVolume || "0",
      priceChange24h: ticker.priceChangePercent || "0",
    });

    result.analysis = analysis;

    const parsed = parseSignal(analysis);
    result.signal = parsed.signal;
    result.confidence = parsed.confidence;

    // Only trade on BUY/SELL with high confidence
    if (
      (parsed.signal !== "BUY" && parsed.signal !== "SELL") ||
      parsed.confidence < 60
    ) {
      result.action = "NO_TRADE";
      result.reason = `Signal: ${parsed.signal}, Confidence: ${parsed.confidence}% - Not enough conviction`;
      return result;
    }

    if (!parsed.entry || !parsed.sl || !parsed.tp1) {
      result.action = "NO_TRADE";
      result.reason = `Incomplete trade setup - Entry: $${parsed.entry}, SL: $${parsed.sl}, TP1: $${parsed.tp1}`;
      return result;
    }

    const price = parseFloat(currentPrice);
    const entryPrice =
      Math.abs(parsed.entry - price) / price > 0.05 ? price : parsed.entry;

    const slDistance = Math.abs(entryPrice - parsed.sl);
    const tp1Distance = Math.abs(parsed.tp1 - entryPrice);
    const rr = tp1Distance / slDistance;

    if (rr < 1.5) {
      result.action = "NO_TRADE";
      result.reason = `Risk:Reward too low (1:${rr.toFixed(1)}). Minimum 1:2 required.`;
      return result;
    }

    const tp2 =
      parsed.tp2 ||
      (parsed.signal === "BUY"
        ? entryPrice + slDistance * 3
        : entryPrice - slDistance * 3);

    const { quantity, riskAmount } = calculatePositionSize(
      entryPrice,
      parsed.sl,
      TOTAL_CAPITAL
    );

    if (quantity <= 0) {
      result.action = "NO_TRADE";
      result.reason = "Invalid position size calculation";
      return result;
    }

    // Write to Trading Journal FIRST
    const journalEntry = {
      symbol,
      side: parsed.signal as "BUY" | "SELL",
      signal: parsed.signal,
      confidence: parsed.confidence,
      entry_price: entryPrice,
      stop_loss: parsed.sl,
      take_profit_1: parsed.tp1,
      take_profit_2: tp2,
      quantity,
      risk_amount: riskAmount,
      risk_reward_ratio: `1:${rr.toFixed(1)} / 1:${(
        Math.abs(tp2 - entryPrice) / slDistance
      ).toFixed(1)}`,
      status: "PENDING",
      analysis_summary: `${parsed.signal} ${symbol} @ $${entryPrice.toFixed(2)} | SL: $${parsed.sl.toFixed(2)} | TP1: $${parsed.tp1.toFixed(2)} (2R) | TP2: $${tp2.toFixed(2)} (3R)`,
      ai_reasoning:
        parsed.reasoning ||
        `AI ${parsed.signal} signal with ${parsed.confidence}% confidence`,
      timeframe: "1d",
      capital: TOTAL_CAPITAL,
    };

    const { data: journalData, error: journalError } = await supabase
      .from("trading_journal")
      .insert(journalEntry)
      .select()
      .single();

    if (journalError) {
      result.action = "ERROR";
      result.reason = `Failed to write journal: ${journalError.message}`;
      return result;
    }

    // Place market order on Binance testnet
    try {
      const tradeAmount = quantity * entryPrice;
      const orderResult = await placeMarketOrder(
        symbol,
        parsed.signal as "BUY" | "SELL",
        Math.max(tradeAmount, 10)
      );

      let fillPrice = entryPrice;
      if (orderResult.fills && orderResult.fills.length > 0) {
        const totalQty = orderResult.fills.reduce(
          (s, f) => s + parseFloat(f.qty),
          0
        );
        const totalCost = orderResult.fills.reduce(
          (s, f) => s + parseFloat(f.price) * parseFloat(f.qty),
          0
        );
        fillPrice = totalCost / totalQty;
      }

      await supabase
        .from("trading_journal")
        .update({
          status: "OPEN",
          order_id: String(orderResult.orderId),
          fill_price: fillPrice,
          quantity: parseFloat(orderResult.executedQty) || quantity,
        })
        .eq("id", journalData.id);

      result.action = "TRADE_PLACED";
      result.trade = {
        ...journalEntry,
        id: journalData.id,
        order_id: String(orderResult.orderId),
        fill_price: fillPrice,
        status: "OPEN",
      };
      result.reason = `${parsed.signal} order placed: ${orderResult.executedQty} ${symbol} @ $${fillPrice.toFixed(2)}`;
    } catch (orderError) {
      await supabase
        .from("trading_journal")
        .update({
          status: "ERROR",
          ai_reasoning:
            journalEntry.ai_reasoning +
            ` | Order error: ${orderError instanceof Error ? orderError.message : "Unknown"}`,
        })
        .eq("id", journalData.id);

      result.action = "ORDER_FAILED";
      result.reason = `Order failed: ${orderError instanceof Error ? orderError.message : "Unknown error"}`;
    }

    return result;
  } catch (error) {
    result.action = "ERROR";
    result.reason = error instanceof Error ? error.message : "Unknown error";
    return result;
  }
}

// --- Monitor open trades for SL/TP hits ---
async function monitorOpenTrades(): Promise<string[]> {
  const notifications: string[] = [];

  const { data: openTrades } = await supabase
    .from("trading_journal")
    .select("*")
    .in("status", ["OPEN"])
    .order("created_at", { ascending: false });

  if (!openTrades || openTrades.length === 0) return notifications;

  for (const trade of openTrades) {
    try {
      const ticker = await fetchTicker(trade.symbol);
      const currentPrice = parseFloat(ticker.lastPrice || ticker.price || "0");
      if (currentPrice === 0) continue;

      const isBuy = trade.side === "BUY";
      const pnl = isBuy
        ? (currentPrice - trade.fill_price) * trade.quantity
        : (trade.fill_price - currentPrice) * trade.quantity;
      const pnlPercent = (pnl / (trade.fill_price * trade.quantity)) * 100;

      const slHit = isBuy
        ? currentPrice <= trade.stop_loss
        : currentPrice >= trade.stop_loss;
      const tp1Hit = isBuy
        ? currentPrice >= trade.take_profit_1
        : currentPrice <= trade.take_profit_1;
      const tp2Hit = isBuy
        ? currentPrice >= trade.take_profit_2
        : currentPrice <= trade.take_profit_2;

      if (slHit) {
        await supabase
          .from("trading_journal")
          .update({
            status: "SL_HIT",
            close_price: currentPrice,
            pnl,
            pnl_percent: pnlPercent,
            closed_at: new Date().toISOString(),
          })
          .eq("id", trade.id);
        notifications.push(
          `SL HIT: ${trade.symbol} | Entry: $${trade.fill_price} | Close: $${currentPrice} | P&L: $${pnl.toFixed(2)}`
        );
      } else if (tp2Hit) {
        await supabase
          .from("trading_journal")
          .update({
            status: "TP2_HIT",
            close_price: currentPrice,
            pnl,
            pnl_percent: pnlPercent,
            closed_at: new Date().toISOString(),
          })
          .eq("id", trade.id);
        notifications.push(
          `TP2 HIT (3R): ${trade.symbol} | Entry: $${trade.fill_price} | Close: $${currentPrice} | P&L: $${pnl.toFixed(2)}`
        );
      } else if (tp1Hit && trade.status !== "TP1_HIT") {
        await supabase
          .from("trading_journal")
          .update({ status: "TP1_HIT" })
          .eq("id", trade.id);
        notifications.push(
          `TP1 HIT (2R): ${trade.symbol} | Entry: $${trade.fill_price} | Current: $${currentPrice} | Trailing to TP2`
        );
      }
    } catch (error) {
      notifications.push(
        `Error monitoring ${trade.symbol}: ${error instanceof Error ? error.message : "Unknown"}`
      );
    }
  }

  return notifications;
}

// --- Main Agent Entry Point (fully server-side, called by cron) ---
export async function runTradingAgent(): Promise<{
  results: AgentResult[];
  monitoring: string[];
  riskCheck: {
    canTrade: boolean;
    reason: string;
    openTrades: number;
    consecutiveLosses: number;
  };
  timestamp: string;
}> {
  const timestamp = new Date().toISOString();

  // 1. Monitor existing open trades
  const monitoring = await monitorOpenTrades();

  // 2. Check risk management
  const riskCheck = await checkRiskManagement();

  // 3. Process each coin
  const results: AgentResult[] = [];

  for (const symbol of TRADING_COINS) {
    if (!riskCheck.canTrade) {
      results.push({
        symbol,
        signal: "BLOCKED",
        confidence: 0,
        action: "RISK_BLOCKED",
        reason: riskCheck.reason,
        analysis: "",
      });
      continue;
    }

    const result = await processCoin(symbol);
    results.push(result);

    // Delay between coins to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  // 4. Send Telegram summary
  const messages: string[] = [...monitoring];

  for (const r of results) {
    if (r.action === "TRADE_PLACED" && r.trade) {
      messages.push(
        `NEW TRADE\n` +
          `${r.trade.side} ${r.symbol}\n` +
          `Entry: $${r.trade.fill_price?.toFixed(2) || r.trade.entry_price.toFixed(2)}\n` +
          `SL: $${r.trade.stop_loss.toFixed(2)} (1R)\n` +
          `TP1: $${r.trade.take_profit_1.toFixed(2)} (2R)\n` +
          `TP2: $${r.trade.take_profit_2.toFixed(2)} (3R)\n` +
          `Risk: $${r.trade.risk_amount.toFixed(2)} | RR: ${r.trade.risk_reward_ratio}\n` +
          `Confidence: ${r.confidence}%`
      );
    } else if (r.action !== "SKIP") {
      messages.push(`${r.symbol}: ${r.signal} - ${r.reason}`);
    }
  }

  if (messages.length > 0) {
    try {
      await sendTelegramMessage(
        `Auto Trading Agent\n${timestamp}\n\n${messages.join("\n\n")}`
      );
    } catch {
      // Telegram is non-critical
    }
  }

  return { results, monitoring, riskCheck, timestamp };
}

// --- Get trading journal entries ---
export async function getTradingJournal(limit = 20) {
  const { data, error } = await supabase
    .from("trading_journal")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

// --- Get trade stats ---
export async function getTradeStats() {
  const { data: trades } = await supabase
    .from("trading_journal")
    .select("status, pnl, pnl_percent")
    .in("status", ["TP1_HIT", "TP2_HIT", "SL_HIT", "OPEN", "PENDING"]);

  if (!trades) {
    return {
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      activeTrades: 0,
      totalPnl: 0,
      avgPnlPercent: 0,
      winRate: 0,
    };
  }

  const closed = trades.filter((t) =>
    ["TP1_HIT", "TP2_HIT", "SL_HIT"].includes(t.status)
  );
  const winning = closed.filter((t) =>
    ["TP1_HIT", "TP2_HIT"].includes(t.status)
  );
  const losing = closed.filter((t) => t.status === "SL_HIT");
  const active = trades.filter((t) =>
    ["OPEN", "PENDING"].includes(t.status)
  );

  return {
    totalTrades: closed.length,
    winningTrades: winning.length,
    losingTrades: losing.length,
    activeTrades: active.length,
    totalPnl: closed.reduce((s, t) => s + (t.pnl || 0), 0),
    avgPnlPercent:
      closed.length > 0
        ? closed.reduce((s, t) => s + (t.pnl_percent || 0), 0) / closed.length
        : 0,
    winRate:
      closed.length > 0 ? (winning.length / closed.length) * 100 : 0,
  };
}
