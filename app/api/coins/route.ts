import { get24hrTickers, getTickerPrice, getKlines } from "@/lib/binance";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get("symbol");

  try {
    if (symbol) {
      const [ticker, klines] = await Promise.all([
        getTickerPrice(symbol),
        getKlines(symbol, "1h", 100),
      ]);
      return Response.json({ ticker, klines });
    }

    const tickers = await get24hrTickers();
    return Response.json(tickers);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to fetch" },
      { status: 500 }
    );
  }
}
