import { runTradingAgent, getTradingJournal, getTradeStats } from "@/lib/trading-agent";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { coinsData, livePrices } = body;

    if (!coinsData || !Array.isArray(coinsData) || coinsData.length === 0) {
      return Response.json(
        { error: "coinsData array is required (fetched client-side from Binance)" },
        { status: 400 }
      );
    }

    const agentResult = await runTradingAgent(coinsData, livePrices || {});
    return Response.json(agentResult);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Agent failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") || "journal";

  try {
    if (type === "stats") {
      const stats = await getTradeStats();
      return Response.json(stats);
    }

    const limit = parseInt(searchParams.get("limit") || "20");
    const journal = await getTradingJournal(limit);
    return Response.json(journal);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to fetch data" },
      { status: 500 }
    );
  }
}
