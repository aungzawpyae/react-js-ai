import { analyzeCoin } from "@/lib/gemini";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { symbol } = body;

    if (!symbol) {
      return Response.json({ error: "Symbol is required" }, { status: 400 });
    }

    const analysis = await analyzeCoin(body);

    return Response.json({ analysis, price: body.currentPrice });
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
