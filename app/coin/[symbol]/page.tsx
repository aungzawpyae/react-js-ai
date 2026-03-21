import Link from "next/link";
import { getKlines, getTickerPrice } from "@/lib/binance";
import { formatPrice, formatPercent, formatVolume, getCoinName } from "@/lib/format";
import PriceChart from "@/components/PriceChart";
import LivePrice from "@/components/LivePrice";
import AnalysisPanel from "@/components/AnalysisPanel";

export default async function CoinPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;

  const [ticker, klines] = await Promise.all([
    getTickerPrice(symbol),
    getKlines(symbol, "1h", 100),
  ]);

  const coinName = getCoinName(symbol);

  return (
    <div className="min-h-screen bg-black">
      <header className="border-b border-zinc-800 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
          <Link
            href="/"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-zinc-800 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 text-sm font-bold text-yellow-400">
              {coinName.slice(0, 2)}
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">{coinName}</h1>
              <p className="text-xs text-zinc-500">{symbol}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-6 px-6 py-8">
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
          <h2 className="mb-4 text-lg font-semibold text-white">Price Chart (1h)</h2>
          <div className="h-64 sm:h-80">
            <PriceChart klines={klines} />
          </div>
        </div>

        {/* AI Analysis */}
        <AnalysisPanel symbol={symbol} />
      </main>
    </div>
  );
}
