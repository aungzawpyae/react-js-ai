"use client";

import { useState, useEffect } from "react";
import { formatPrice } from "@/lib/format";

interface Balance {
  asset: string;
  free: string;
  locked: string;
}

interface OrderResult {
  symbol: string;
  orderId: number;
  side: string;
  status: string;
  executedQty: string;
  type: string;
  fills?: { price: string; qty: string }[];
}

export default function TradePanel({ symbol }: { symbol: string }) {
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OrderResult | null>(null);
  const [error, setError] = useState("");
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loadingBalances, setLoadingBalances] = useState(true);

  const baseAsset = symbol.replace("USDT", "");

  useEffect(() => {
    setLoadingBalances(true);
    fetch("/api/trade")
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) setBalances(data);
      })
      .catch(() => {})
      .finally(() => setLoadingBalances(false));
  }, [result]);

  const usdtBalance = balances.find((b) => b.asset === "USDT");
  const coinBalance = balances.find((b) => b.asset === baseAsset);

  async function handleTrade() {
    if (!amount || parseFloat(amount) <= 0) {
      setError("Enter a valid amount");
      return;
    }

    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/trade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, side, amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Order failed");
      } else {
        setResult(data);
        setAmount("");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }

  const presetAmounts = [10, 25, 50, 100];

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <h2 className="mb-4 text-lg font-semibold text-white">
        Demo Trading
        <span className="ml-2 rounded-md bg-yellow-500/10 px-2 py-0.5 text-xs font-medium text-yellow-400">
          TESTNET
        </span>
      </h2>

      {/* Balances */}
      <div className="mb-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-xs text-zinc-500">USDT Balance</p>
          <p className="font-mono text-sm font-medium text-white">
            {loadingBalances
              ? "..."
              : usdtBalance
                ? formatPrice(usdtBalance.free)
                : "0.00"}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
          <p className="text-xs text-zinc-500">{baseAsset} Balance</p>
          <p className="font-mono text-sm font-medium text-white">
            {loadingBalances
              ? "..."
              : coinBalance
                ? parseFloat(coinBalance.free).toFixed(6)
                : "0.000000"}
          </p>
        </div>
      </div>

      {/* Buy / Sell Toggle */}
      <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl bg-zinc-950 p-1">
        <button
          onClick={() => setSide("BUY")}
          className={`rounded-lg py-2.5 text-sm font-semibold transition-all ${
            side === "BUY"
              ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Buy
        </button>
        <button
          onClick={() => setSide("SELL")}
          className={`rounded-lg py-2.5 text-sm font-semibold transition-all ${
            side === "SELL"
              ? "bg-red-500 text-white shadow-lg shadow-red-500/20"
              : "text-zinc-400 hover:text-white"
          }`}
        >
          Sell
        </button>
      </div>

      {/* Amount Input */}
      <div className="mb-3">
        <label className="mb-1.5 block text-xs text-zinc-500">
          Amount (USDT)
        </label>
        <input
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          min="0"
          step="0.01"
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 font-mono text-sm text-white placeholder-zinc-600 outline-none transition-colors focus:border-zinc-600"
        />
      </div>

      {/* Preset Amounts */}
      <div className="mb-4 flex gap-2">
        {presetAmounts.map((preset) => (
          <button
            key={preset}
            onClick={() => setAmount(preset.toString())}
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-950 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white"
          >
            ${preset}
          </button>
        ))}
      </div>

      {/* Submit */}
      <button
        onClick={handleTrade}
        disabled={loading || !amount}
        className={`w-full rounded-xl py-3 text-sm font-bold transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
          side === "BUY"
            ? "bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/20"
            : "bg-red-500 text-white hover:bg-red-400 shadow-lg shadow-red-500/20"
        }`}
      >
        {loading
          ? "Placing Order..."
          : `${side === "BUY" ? "Buy" : "Sell"} ${baseAsset}`}
      </button>

      {/* Error */}
      {error && (
        <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Success */}
      {result && (
        <div className="mt-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <p className="text-xs font-medium text-emerald-400">
            Order {result.status}
          </p>
          <div className="mt-2 space-y-1 text-xs text-zinc-400">
            <p>
              Side: <span className="text-white">{result.side}</span>
            </p>
            <p>
              Qty: <span className="text-white">{result.executedQty}</span>
            </p>
            {result.fills && result.fills.length > 0 && (
              <p>
                Price:{" "}
                <span className="text-white">
                  ${formatPrice(result.fills[0].price)}
                </span>
              </p>
            )}
            <p>
              Order ID:{" "}
              <span className="font-mono text-white">{result.orderId}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
