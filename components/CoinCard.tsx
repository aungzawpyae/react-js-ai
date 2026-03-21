"use client";

import Link from "next/link";
import { formatPrice, formatPercent, formatVolume, getCoinName } from "@/lib/format";

interface CoinCardProps {
  symbol: string;
  price: string;
  priceChangePercent: string;
  volume: string;
  high: string;
  low: string;
  quoteVolume: string;
}

export default function CoinCard({
  symbol,
  price,
  priceChangePercent,
  high,
  low,
  quoteVolume,
}: CoinCardProps) {
  const change = parseFloat(priceChangePercent);
  const isPositive = change >= 0;
  const coinName = getCoinName(symbol);

  return (
    <Link href={`/coin/${symbol}`}>
      <div className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5 transition-all hover:border-zinc-600 hover:bg-zinc-900 hover:shadow-lg hover:shadow-zinc-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-500/20 to-orange-500/20 text-sm font-bold text-yellow-400">
              {coinName.slice(0, 2)}
            </div>
            <div>
              <h3 className="font-semibold text-white">{coinName}</h3>
              <p className="text-xs text-zinc-500">{symbol}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="font-mono text-lg font-semibold text-white">
              ${formatPrice(price)}
            </p>
            <p
              className={`text-sm font-medium ${
                isPositive ? "text-emerald-400" : "text-red-400"
              }`}
            >
              {formatPercent(priceChangePercent)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3 border-t border-zinc-800 pt-4">
          <div>
            <p className="text-xs text-zinc-500">High</p>
            <p className="font-mono text-sm text-zinc-300">${formatPrice(high)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Low</p>
            <p className="font-mono text-sm text-zinc-300">${formatPrice(low)}</p>
          </div>
          <div>
            <p className="text-xs text-zinc-500">Vol</p>
            <p className="font-mono text-sm text-zinc-300">${formatVolume(quoteVolume)}</p>
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      </div>
    </Link>
  );
}
