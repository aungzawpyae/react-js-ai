// Public market data always uses production API (no auth needed)
const BASE_URL = "https://api.binance.com";
// Testnet for authenticated trading operations (orders, account)
const TRADE_BASE_URL = process.env.BINANCE_BASE_URL || "https://testnet.binance.vision";

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
