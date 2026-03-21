const BASE_URL = process.env.BINANCE_BASE_URL || "https://testnet.binance.vision";

export interface TickerData {
  symbol: string;
  price: string;
  priceChangePercent: string;
  volume: string;
  high: string;
  low: string;
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
  const res = await fetch(`${BASE_URL}/api/v3/ticker/24hr`, {
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error("Failed to fetch tickers");
  const data = await res.json();
  return data
    .filter((t: TickerData) => t.symbol.endsWith("USDT"))
    .sort(
      (a: TickerData, b: TickerData) =>
        parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume)
    )
    .slice(0, 50);
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
  const res = await fetch(`${BASE_URL}/api/v3/ticker/24hr?symbol=${symbol}`, {
    next: { revalidate: 0 },
  });
  if (!res.ok) throw new Error("Failed to fetch ticker");
  return res.json();
}
