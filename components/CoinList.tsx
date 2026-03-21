"use client";

import { useEffect, useRef, useState } from "react";
import CoinCard from "./CoinCard";
import type { CoinTicker, MiniTicker } from "@/lib/types";

export default function CoinList({
  initialData,
}: {
  initialData: CoinTicker[];
}) {
  const [coins, setCoins] = useState<CoinTicker[]>(initialData);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"volume" | "change" | "price">("volume");
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const ws = new WebSocket("wss://stream.binance.com:9443/ws/!miniTicker@arr");
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data: MiniTicker[] = JSON.parse(event.data);
      setCoins((prev) => {
        const updated = [...prev];
        for (const ticker of data) {
          if (!ticker.s.endsWith("USDT")) continue;
          const idx = updated.findIndex((c) => c.symbol === ticker.s);
          if (idx !== -1) {
            const openPrice = parseFloat(ticker.o);
            const closePrice = parseFloat(ticker.c);
            const changePercent = openPrice > 0
              ? (((closePrice - openPrice) / openPrice) * 100).toFixed(2)
              : updated[idx].priceChangePercent;

            updated[idx] = {
              ...updated[idx],
              price: ticker.c,
              high: ticker.h,
              low: ticker.l,
              volume: ticker.v,
              quoteVolume: ticker.q,
              priceChangePercent: changePercent,
            };
          }
        }
        return updated;
      });
    };

    return () => {
      ws.close();
    };
  }, []);

  const filtered = coins
    .filter((c) =>
      c.symbol.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      if (sortBy === "volume")
        return parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume);
      if (sortBy === "change")
        return (
          Math.abs(parseFloat(b.priceChangePercent)) -
          Math.abs(parseFloat(a.priceChangePercent))
        );
      return parseFloat(b.price) - parseFloat(a.price);
    });

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <input
            type="text"
            placeholder="Search coins..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3 pl-10 text-sm text-white placeholder-zinc-500 outline-none transition-colors focus:border-yellow-500/50 sm:w-72"
          />
          <svg
            className="absolute left-3 top-3.5 h-4 w-4 text-zinc-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>

        <div className="flex gap-2">
          {(["volume", "change", "price"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`rounded-lg px-4 py-2 text-xs font-medium capitalize transition-colors ${
                sortBy === s
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((coin) => (
          <CoinCard key={coin.symbol} {...coin} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="py-20 text-center text-zinc-500">
          No coins found matching &quot;{search}&quot;
        </div>
      )}
    </div>
  );
}
