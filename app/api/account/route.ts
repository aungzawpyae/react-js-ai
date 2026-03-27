import {
  getAccountBalances,
  getFuturesBalances,
  getFuturesPositions,
} from "@/lib/binance";

interface PriceMap {
  [key: string]: number;
}

async function getPrices(): Promise<PriceMap> {
  try {
    const res = await fetch("https://api.binance.com/api/v3/ticker/price", {
      cache: "no-store",
    });
    const data: { symbol: string; price: string }[] = await res.json();
    const map: PriceMap = {};
    for (const t of data) {
      if (t.symbol.endsWith("USDT")) {
        map[t.symbol.replace("USDT", "")] = parseFloat(t.price);
      }
    }
    map["USDT"] = 1;
    map["BUSD"] = 1;
    map["USDC"] = 1;
    map["FDUSD"] = 1;
    return map;
  } catch {
    return { USDT: 1 };
  }
}

function toUsd(amount: number, asset: string, prices: PriceMap): number {
  if (["USDT", "BUSD", "USDC", "FDUSD"].includes(asset)) return amount;
  return amount * (prices[asset] || 0);
}

export async function GET() {
  try {
    const prices = await getPrices();

    // Fetch spot and futures in parallel
    const [spotBalances, futuresResult, futuresPositionsResult] =
      await Promise.allSettled([
        getAccountBalances(),
        getFuturesBalances(),
        getFuturesPositions(),
      ]);

    // Spot
    const spot =
      spotBalances.status === "fulfilled" ? spotBalances.value : [];
    const spotWithUsd = spot.map((b) => {
      const total = parseFloat(b.free) + parseFloat(b.locked);
      return {
        ...b,
        total,
        usdValue: toUsd(total, b.asset, prices),
      };
    });
    const spotTotal = spotWithUsd.reduce((sum, b) => sum + b.usdValue, 0);

    // Futures
    const futures =
      futuresResult.status === "fulfilled" ? futuresResult.value : [];
    const futuresWithUsd = futures.map((b) => {
      const wallet = parseFloat(b.walletBalance);
      const unrealized = parseFloat(b.unrealizedProfit);
      return {
        ...b,
        usdValue: toUsd(wallet + unrealized, b.asset, prices),
      };
    });
    const futuresTotal = futuresWithUsd.reduce(
      (sum, b) => sum + b.usdValue,
      0
    );

    // Futures positions
    const positions =
      futuresPositionsResult.status === "fulfilled"
        ? futuresPositionsResult.value
        : [];

    return Response.json({
      spot: {
        balances: spotWithUsd,
        totalUsd: spotTotal,
      },
      futures: {
        balances: futuresWithUsd,
        positions,
        totalUsd: futuresTotal,
      },
      totalCapitalUsd: spotTotal + futuresTotal,
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch account",
      },
      { status: 500 }
    );
  }
}
