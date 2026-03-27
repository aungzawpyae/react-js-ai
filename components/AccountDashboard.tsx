"use client";

import { useEffect, useState } from "react";
import { formatPrice, formatVolume } from "@/lib/format";

interface SpotBalance {
  asset: string;
  free: string;
  locked: string;
  total: number;
  usdValue: number;
}

interface FuturesBalance {
  asset: string;
  walletBalance: string;
  unrealizedProfit: string;
  marginBalance: string;
  availableBalance: string;
  usdValue: number;
}

interface FuturesPosition {
  symbol: string;
  positionAmt: string;
  entryPrice: string;
  unrealizedProfit: string;
  leverage: string;
  positionSide: string;
}

interface AccountData {
  spot: { balances: SpotBalance[]; totalUsd: number };
  futures: {
    balances: FuturesBalance[];
    positions: FuturesPosition[];
    totalUsd: number;
  };
  totalCapitalUsd: number;
}

export default function AccountDashboard() {
  const [data, setData] = useState<AccountData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  function fetchData() {
    setLoading(true);
    setError("");
    fetch("/api/account")
      .then((res) => res.json())
      .then((d) => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Failed to load account data"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="py-20 text-center text-zinc-500">
        Loading account data...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
        <p className="text-sm text-red-400">{error}</p>
        <button
          onClick={fetchData}
          className="mt-3 rounded-lg bg-zinc-800 px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Total Capital Card */}
      <div className="rounded-2xl border border-zinc-800 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-400">Total Capital</p>
            <p className="mt-1 font-mono text-4xl font-bold text-white">
              ${formatPrice(data.totalCapitalUsd)}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Spot + Futures combined (TESTNET)
            </p>
          </div>
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-yellow-400/20 to-orange-500/20">
            <svg
              className="h-7 w-7 text-yellow-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        </div>

        {/* Spot / Futures Split Bar */}
        <div className="mt-5">
          <div className="mb-2 flex justify-between text-xs">
            <span className="text-emerald-400">
              Spot: ${formatPrice(data.spot.totalUsd)}
            </span>
            <span className="text-blue-400">
              Futures: ${formatPrice(data.futures.totalUsd)}
            </span>
          </div>
          <div className="flex h-2 overflow-hidden rounded-full bg-zinc-800">
            {data.totalCapitalUsd > 0 && (
              <>
                <div
                  className="bg-emerald-500 transition-all"
                  style={{
                    width: `${(data.spot.totalUsd / data.totalCapitalUsd) * 100}%`,
                  }}
                />
                <div
                  className="bg-blue-500 transition-all"
                  style={{
                    width: `${(data.futures.totalUsd / data.totalCapitalUsd) * 100}%`,
                  }}
                />
              </>
            )}
          </div>
        </div>
      </div>

      {/* Spot & Futures Cards */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Spot Account */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
              <h3 className="text-lg font-semibold text-white">
                Spot Account
              </h3>
            </div>
            <span className="font-mono text-sm font-medium text-emerald-400">
              ${formatPrice(data.spot.totalUsd)}
            </span>
          </div>

          {data.spot.balances.length === 0 ? (
            <p className="text-sm text-zinc-500">No spot balances</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2 border-b border-zinc-800 pb-2 text-xs text-zinc-500">
                <span>Asset</span>
                <span className="text-right">Available</span>
                <span className="text-right">Locked</span>
                <span className="text-right">USD Value</span>
              </div>
              {data.spot.balances
                .sort((a, b) => b.usdValue - a.usdValue)
                .map((b) => (
                  <div
                    key={b.asset}
                    className="grid grid-cols-4 gap-2 rounded-lg py-1.5 text-sm"
                  >
                    <span className="font-medium text-white">{b.asset}</span>
                    <span className="text-right font-mono text-zinc-300">
                      {formatVolume(b.free)}
                    </span>
                    <span className="text-right font-mono text-zinc-500">
                      {parseFloat(b.locked) > 0
                        ? formatVolume(b.locked)
                        : "-"}
                    </span>
                    <span className="text-right font-mono text-zinc-300">
                      ${formatPrice(b.usdValue)}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Futures Account */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
              <h3 className="text-lg font-semibold text-white">
                Futures Account
              </h3>
            </div>
            <span className="font-mono text-sm font-medium text-blue-400">
              ${formatPrice(data.futures.totalUsd)}
            </span>
          </div>

          {data.futures.balances.length === 0 ? (
            <p className="text-sm text-zinc-500">No futures balances</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-4 gap-2 border-b border-zinc-800 pb-2 text-xs text-zinc-500">
                <span>Asset</span>
                <span className="text-right">Wallet</span>
                <span className="text-right">Unrealized PnL</span>
                <span className="text-right">USD Value</span>
              </div>
              {data.futures.balances
                .sort((a, b) => b.usdValue - a.usdValue)
                .map((b) => {
                  const pnl = parseFloat(b.unrealizedProfit);
                  return (
                    <div
                      key={b.asset}
                      className="grid grid-cols-4 gap-2 rounded-lg py-1.5 text-sm"
                    >
                      <span className="font-medium text-white">{b.asset}</span>
                      <span className="text-right font-mono text-zinc-300">
                        {formatVolume(b.walletBalance)}
                      </span>
                      <span
                        className={`text-right font-mono ${
                          pnl >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {pnl >= 0 ? "+" : ""}
                        {formatPrice(pnl)}
                      </span>
                      <span className="text-right font-mono text-zinc-300">
                        ${formatPrice(b.usdValue)}
                      </span>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Open Positions */}
          {data.futures.positions.length > 0 && (
            <div className="mt-5 border-t border-zinc-800 pt-4">
              <h4 className="mb-3 text-sm font-medium text-zinc-400">
                Open Positions
              </h4>
              <div className="space-y-2">
                <div className="grid grid-cols-5 gap-2 border-b border-zinc-800 pb-2 text-xs text-zinc-500">
                  <span>Symbol</span>
                  <span className="text-right">Size</span>
                  <span className="text-right">Entry</span>
                  <span className="text-right">PnL</span>
                  <span className="text-right">Leverage</span>
                </div>
                {data.futures.positions.map((p) => {
                  const pnl = parseFloat(p.unrealizedProfit);
                  const size = parseFloat(p.positionAmt);
                  return (
                    <div
                      key={p.symbol + p.positionSide}
                      className="grid grid-cols-5 gap-2 rounded-lg py-1.5 text-sm"
                    >
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            size > 0 ? "bg-emerald-500" : "bg-red-500"
                          }`}
                        />
                        <span className="font-medium text-white">
                          {p.symbol.replace("USDT", "")}
                        </span>
                      </div>
                      <span
                        className={`text-right font-mono ${
                          size > 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {size > 0 ? "+" : ""}
                        {p.positionAmt}
                      </span>
                      <span className="text-right font-mono text-zinc-300">
                        ${formatPrice(p.entryPrice)}
                      </span>
                      <span
                        className={`text-right font-mono ${
                          pnl >= 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {pnl >= 0 ? "+" : ""}
                        ${formatPrice(pnl)}
                      </span>
                      <span className="text-right font-mono text-zinc-400">
                        {p.leverage}x
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
