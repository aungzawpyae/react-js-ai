"use client";

import { useEffect, useState } from "react";
import { formatPrice, formatPercent, formatVolume, getCoinName } from "@/lib/format";
import LivePrice from "./LivePrice";
import PriceChart from "./PriceChart";
import AnalysisPanel from "./AnalysisPanel";
import TradePanel from "./TradePanel";

interface TickerData {
  lastPrice: string;
  priceChangePercent: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
}

const defaultTicker: TickerData = {
  lastPrice: "0",
  priceChangePercent: "0",
  highPrice: "0",
  lowPrice: "0",
  volume: "0",
};

export default function CoinDetail({ symbol }: { symbol: string }) {
  const [ticker, setTicker] = useState<TickerData | null>(null);
  const coinName = getCoinName(symbol);

  useEffect(() => {
    fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`)
      .then((res) => res.json())
      .then((data) => setTicker(data))
      .catch(() => setTicker(defaultTicker));
  }, [symbol]);

  if (!ticker) {
    return <div className="py-20 text-center text-zinc-500">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Price Section */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <LivePrice
          symbol={symbol}
          initialPrice={ticker.lastPrice}
          initialChange={ticker.priceChangePercent}
        />

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-zinc-500">24h High</p>
            <p className="font-mono text-sm font-medium text-white">
              ${formatPrice(ticker.highPrice)}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">24h Low</p>
            <p className="font-mono text-sm font-medium text-white">
              ${formatPrice(ticker.lowPrice)}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">24h Volume</p>
            <p className="font-mono text-sm font-medium text-white">
              {formatVolume(ticker.volume)} {coinName}
            </p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">24h Change</p>
            <p
              className={`font-mono text-sm font-medium ${
                parseFloat(ticker.priceChangePercent) >= 0
                  ? "text-emerald-400"
                  : "text-red-400"
              }`}
            >
              {formatPercent(ticker.priceChangePercent)}
            </p>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="mb-4 text-lg font-semibold text-white">Price Chart</h2>
        <div className="h-[500px]">
          <PriceChart symbol={symbol} />
        </div>
      </div>

      {/* Trade Panel */}
      <TradePanel symbol={symbol} />

      {/* AI Analysis */}
      <AnalysisPanel symbol={symbol} />
    </div>
  );
}
