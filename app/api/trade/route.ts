import {
  placeMarketOrder,
  getAccountBalances,
} from "@/lib/binance";

export async function POST(request: Request) {
  try {
    const { symbol, side, amount } = await request.json();

    if (!symbol || !side || !amount) {
      return Response.json(
        { error: "Missing required fields: symbol, side, amount" },
        { status: 400 }
      );
    }

    if (side !== "BUY" && side !== "SELL") {
      return Response.json(
        { error: "Side must be BUY or SELL" },
        { status: 400 }
      );
    }

    const quoteAmount = parseFloat(amount);
    if (isNaN(quoteAmount) || quoteAmount <= 0) {
      return Response.json(
        { error: "Amount must be a positive number" },
        { status: 400 }
      );
    }

    const result = await placeMarketOrder(symbol, side, quoteAmount);
    return Response.json(result);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Order failed" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const balances = await getAccountBalances();
    return Response.json(balances);
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to fetch balances" },
      { status: 500 }
    );
  }
}
