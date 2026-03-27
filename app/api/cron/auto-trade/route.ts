import { runTradingAgent } from "@/lib/trading-agent";

export const maxDuration = 60; // Allow up to 60s for AI analysis of 3 coins

export async function GET(request: Request) {
  // Verify the request is from Vercel Cron (security)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runTradingAgent();
    return Response.json({
      ok: true,
      timestamp: result.timestamp,
      trades: result.results.map((r) => ({
        symbol: r.symbol,
        signal: r.signal,
        confidence: r.confidence,
        action: r.action,
        reason: r.reason,
      })),
      monitoring: result.monitoring,
      riskCheck: result.riskCheck,
    });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "Agent failed" },
      { status: 500 }
    );
  }
}
