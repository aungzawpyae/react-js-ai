import { getTradingJournal, getTradeStats } from "@/lib/trading-agent";

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
