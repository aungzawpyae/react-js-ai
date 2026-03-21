import Link from "next/link";
import { getCoinName } from "@/lib/format";
import CoinDetail from "@/components/CoinDetail";

export default async function CoinPage({
  params,
}: {
  params: Promise<{ symbol: string }>;
}) {
  const { symbol } = await params;
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

      <main className="mx-auto max-w-5xl px-6 py-8">
        <CoinDetail symbol={symbol} />
      </main>
    </div>
  );
}
