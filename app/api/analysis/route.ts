import { analyzeCoin } from "@/lib/gemini";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const { symbol, klines, currentPrice } = await request.json();

    if (!symbol) {
      return Response.json({ error: "Symbol is required" }, { status: 400 });
    }

    const analysis = await analyzeCoin(symbol, klines || [], currentPrice || "0");

    return Response.json({ analysis, price: currentPrice });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
