import crypto from "crypto";

// Public market data always uses production API (no auth needed)
const BASE_URL = "https://api.binance.com";
// Testnet for authenticated trading operations (orders, account)
const TRADE_BASE_URL = process.env.BINANCE_BASE_URL || "https://testnet.binance.vision";
const API_KEY = process.env.BINANCE_API_KEY || "";
const API_SECRET = process.env.BINANCE_API_SECRET || "";

export interface TickerData {
  symbol: string;
  price: string;
  lastPrice?: string;
  priceChangePercent: string;
  volume: string;
  high: string;
  highPrice?: string;
  low: string;
  lowPrice?: string;
  quoteVolume: string;
}

export interface KlineData {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
}

export async function get24hrTickers(): Promise<TickerData[]> {
  try {
  const res = await fetch(`${BASE_URL}/api/v3/ticker/24hr`, {
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return data
    .filter((t: TickerData) => t.symbol.endsWith("USDT") && (t.lastPrice || t.price))
    .map((t: TickerData) => ({
      ...t,
      price: t.lastPrice || t.price || "0",
      high: t.highPrice || t.high || "0",
      low: t.lowPrice || t.low || "0",
      quoteVolume: t.quoteVolume || "0",
      priceChangePercent: t.priceChangePercent || "0",
      volume: t.volume || "0",
    }))
    .sort(
      (a: TickerData, b: TickerData) =>
        parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume)
    )
    .slice(0, 50);
  } catch {
    return [];
  }
}

export async function getKlines(
  symbol: string,
  interval: string = "1h",
  limit: number = 100
): Promise<KlineData[]> {
  const res = await fetch(
    `${BASE_URL}/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`,
    { next: { revalidate: 0 } }
  );
  if (!res.ok) throw new Error("Failed to fetch klines");
  const data = await res.json();
  return data.map((k: (string | number)[]) => ({
    openTime: k[0] as number,
    open: k[1] as string,
    high: k[2] as string,
    low: k[3] as string,
    close: k[4] as string,
    volume: k[5] as string,
    closeTime: k[6] as number,
  }));
}

export async function getTickerPrice(symbol: string) {
  try {
    const res = await fetch(`${BASE_URL}/api/v3/ticker/24hr?symbol=${symbol}`, {
      next: { revalidate: 0 },
    });
    if (!res.ok) return { lastPrice: "0", priceChangePercent: "0", highPrice: "0", lowPrice: "0", volume: "0" };
    return res.json();
  } catch {
    return { lastPrice: "0", priceChangePercent: "0", highPrice: "0", lowPrice: "0", volume: "0" };
  }
}

// --- Authenticated Trading Functions (Binance Testnet) ---

function signQuery(queryString: string): string {
  const signature = crypto
    .createHmac("sha256", API_SECRET)
    .update(queryString)
    .digest("hex");
  return `${queryString}&signature=${signature}`;
}

async function authenticatedRequest(
  endpoint: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  params: Record<string, string | number> = {}
) {
  const timestamp = Date.now();
  const allParams = { ...params, timestamp };
  const queryString = Object.entries(allParams)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  const signedQuery = signQuery(queryString);

  const url =
    method === "GET"
      ? `${TRADE_BASE_URL}${endpoint}?${signedQuery}`
      : `${TRADE_BASE_URL}${endpoint}`;

  const res = await fetch(url, {
    method,
    headers: {
      "X-MBX-APIKEY": API_KEY,
      ...(method === "POST"
        ? { "Content-Type": "application/x-www-form-urlencoded" }
        : {}),
    },
    ...(method === "POST" ? { body: signedQuery } : {}),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Binance API error: ${JSON.stringify(data)}`);
  }
  return data;
}

export interface AccountBalance {
  asset: string;
  free: string;
  locked: string;
}

export async function getAccountBalances(): Promise<AccountBalance[]> {
  const account = await authenticatedRequest("/api/v3/account");
  return account.balances.filter(
    (b: AccountBalance) => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0
  );
}

export async function getUSDTBalance(): Promise<number> {
  const account = await authenticatedRequest("/api/v3/account");
  const usdt = account.balances.find(
    (b: AccountBalance) => b.asset === "USDT"
  );
  return usdt ? parseFloat(usdt.free) : 0;
}

export interface OrderResult {
  symbol: string;
  orderId: number;
  clientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  status: string;
  type: string;
  side: string;
  fills?: { price: string; qty: string; commission: string }[];
}

export interface SymbolInfo {
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  filters: {
    filterType: string;
    minQty?: string;
    stepSize?: string;
    minNotional?: string;
    tickSize?: string;
  }[];
}

export async function getSymbolInfo(symbol: string): Promise<SymbolInfo> {
  const res = await fetch(
    `${TRADE_BASE_URL}/api/v3/exchangeInfo?symbol=${symbol}`
  );
  const data = await res.json();
  return data.symbols[0];
}

function adjustQuantity(qty: number, stepSize: string): string {
  const step = parseFloat(stepSize);
  const precision = stepSize.indexOf("1") - stepSize.indexOf(".");
  const adjusted = Math.floor(qty / step) * step;
  return adjusted.toFixed(Math.max(0, precision));
}

function adjustPrice(price: number, tickSize: string): string {
  const tick = parseFloat(tickSize);
  const precision = tickSize.indexOf("1") - tickSize.indexOf(".");
  const adjusted = Math.round(price / tick) * tick;
  return adjusted.toFixed(Math.max(0, precision));
}

export async function placeMarketOrder(
  symbol: string,
  side: "BUY" | "SELL",
  quoteAmount: number
): Promise<OrderResult> {
  const params: Record<string, string | number> = {
    symbol,
    side,
    type: "MARKET",
    quoteOrderQty: quoteAmount.toFixed(2),
  };
  return authenticatedRequest("/api/v3/order", "POST", params);
}

export async function placeLimitOrder(
  symbol: string,
  side: "BUY" | "SELL",
  quantity: string,
  price: string
): Promise<OrderResult> {
  return authenticatedRequest("/api/v3/order", "POST", {
    symbol,
    side,
    type: "LIMIT",
    timeInForce: "GTC",
    quantity,
    price,
  });
}

export async function placeOCOOrder(
  symbol: string,
  side: "SELL" | "BUY",
  quantity: string,
  takeProfitPrice: string,
  stopLossPrice: string,
  stopLimitPrice: string
): Promise<unknown> {
  return authenticatedRequest("/api/v3/order/oco", "POST", {
    symbol,
    side,
    quantity,
    price: takeProfitPrice,
    stopPrice: stopLossPrice,
    stopLimitPrice,
    stopLimitTimeInForce: "GTC",
  });
}

export async function getOrderStatus(
  symbol: string,
  orderId: number
): Promise<OrderResult> {
  return authenticatedRequest("/api/v3/order", "GET", { symbol, orderId });
}

export async function getOpenOrders(symbol?: string): Promise<OrderResult[]> {
  const params: Record<string, string | number> = symbol ? { symbol } : {};
  return authenticatedRequest("/api/v3/openOrders", "GET", params);
}

export async function cancelOrder(
  symbol: string,
  orderId: number
): Promise<OrderResult> {
  return authenticatedRequest("/api/v3/order", "DELETE", { symbol, orderId });
}
