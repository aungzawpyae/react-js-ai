import { analyzeCoin } from "@/lib/gemini";
import { getKlines, getTickerPrice } from "@/lib/binance";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { symbol } = await request.json();

    if (!symbol) {
      return Response.json({ error: "Symbol is required" }, { status: 400 });
    }

    const [ticker, klines] = await Promise.all([
      getTickerPrice(symbol),
      getKlines(symbol, "1h", 100),
    ]);

    const analysis = await analyzeCoin(symbol, klines, ticker.lastPrice);

    return Response.json({ analysis, price: ticker.lastPrice });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
