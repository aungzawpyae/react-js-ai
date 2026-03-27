import Link from "next/link";
import CoinList from "@/components/CoinList";

export default function Home() {

  return (
    <div className="min-h-screen bg-black">
      <header className="border-b border-zinc-800 bg-black/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500">
              <svg className="h-5 w-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-white">CryptoTrader</h1>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/auto-trade"
              className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-yellow-500/20 to-orange-500/20 px-3 py-1.5 text-xs font-semibold text-yellow-400 transition-all hover:from-yellow-500/30 hover:to-orange-500/30"
            >
              AI Agent
            </Link>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Live
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-white">Markets</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Top 50 USDT pairs by volume - Real-time data from Binance
          </p>
        </div>

        <CoinList />
      </main>
    </div>
  );
}
