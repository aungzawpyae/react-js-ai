"use client";

import { useState, useEffect, useCallback } from "react";
import { formatPrice } from "@/lib/format";

interface TradeEntry {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  signal: string;
  confidence: number;
  entry_price: number;
  stop_loss: number;
  take_profit_1: number;
  take_profit_2: number;
  quantity: number;
  risk_amount: number;
  risk_reward_ratio: string;
  status: string;
  order_id?: string;
  fill_price?: number;
  close_price?: number;
  pnl?: number;
  pnl_percent?: number;
  analysis_summary: string;
  ai_reasoning: string;
  capital: number;
  created_at: string;
  closed_at?: string;
}

interface TradeStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  activeTrades: number;
  totalPnl: number;
  avgPnlPercent: number;
  winRate: number;
}

export default function AutoTradePanel() {
  const [journal, setJournal] = useState<TradeEntry[]>([]);
  const [stats, setStats] = useState<TradeStats | null>(null);
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const [journalRes, statsRes] = await Promise.all([
        fetch("/api/auto-trade?type=journal&limit=20"),
        fetch("/api/auto-trade?type=stats"),
      ]);
      if (journalRes.ok) setJournal(await journalRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
      setLastRefresh(new Date());
    } catch {
      // silent
    }
  }, []);

  // Fetch on mount and auto-refresh every 30s
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const statusColor = (status: string) => {
    switch (status) {
      case "OPEN":
        return "text-blue-400 bg-blue-400/10";
      case "PENDING":
        return "text-yellow-400 bg-yellow-400/10";
      case "TP1_HIT":
        return "text-emerald-400 bg-emerald-400/10";
      case "TP2_HIT":
        return "text-green-400 bg-green-400/10";
      case "SL_HIT":
        return "text-red-400 bg-red-400/10";
      case "CANCELLED":
        return "text-zinc-400 bg-zinc-400/10";
      case "ERROR":
        return "text-orange-400 bg-orange-400/10";
      default:
        return "text-zinc-400 bg-zinc-400/10";
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Banner */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-white">
                Auto Trading Agent
              </h3>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                Running (every 1 min)
              </span>
            </div>
            <p className="mt-1 text-sm text-zinc-400">
              BTC, ETH, SOL | Daily TF | $100 Capital | 1R SL, 2R/3R TP | Cron powered
            </p>
          </div>
          <div className="text-right text-xs text-zinc-500">
            <p>Last refresh</p>
            <p className="text-zinc-400">{lastRefresh.toLocaleTimeString()}</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          <StatCard label="Total Trades" value={stats.totalTrades} />
          <StatCard
            label="Wins"
            value={stats.winningTrades}
            color="text-emerald-400"
          />
          <StatCard
            label="Losses"
            value={stats.losingTrades}
            color="text-red-400"
          />
          <StatCard
            label="Active"
            value={stats.activeTrades}
            color="text-blue-400"
          />
          <StatCard
            label="Win Rate"
            value={`${stats.winRate.toFixed(1)}%`}
            color={stats.winRate >= 50 ? "text-emerald-400" : "text-red-400"}
          />
          <StatCard
            label="Total P&L"
            value={`$${stats.totalPnl.toFixed(2)}`}
            color={stats.totalPnl >= 0 ? "text-emerald-400" : "text-red-400"}
          />
          <StatCard
            label="Avg P&L %"
            value={`${stats.avgPnlPercent.toFixed(2)}%`}
            color={stats.avgPnlPercent >= 0 ? "text-emerald-400" : "text-red-400"}
          />
        </div>
      )}

      {/* Trading Journal */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50">
        <div className="border-b border-zinc-800 px-6 py-4">
          <h3 className="text-lg font-semibold text-white">Trading Journal</h3>
          <p className="text-xs text-zinc-500">
            All trades logged before execution - Risk managed at 1R per trade
          </p>
        </div>

        {journal.length === 0 ? (
          <div className="px-6 py-12 text-center text-zinc-500">
            No trades yet. The cron agent is running every minute and will trade when conditions are met.
          </div>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {journal.map((trade) => (
              <div
                key={trade.id}
                className="px-6 py-4 transition-colors hover:bg-zinc-800/30 cursor-pointer"
                onClick={() =>
                  setExpandedTrade(
                    expandedTrade === trade.id ? null : trade.id
                  )
                }
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                        trade.side === "BUY"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {trade.side === "BUY" ? "B" : "S"}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-white">
                          {trade.symbol.replace("USDT", "")}
                        </span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(
                            trade.status
                          )}`}
                        >
                          {trade.status}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {trade.confidence}% conf
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500">
                        {new Date(trade.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-right">
                    <div>
                      <p className="text-xs text-zinc-500">Entry</p>
                      <p className="font-mono text-sm text-white">
                        ${formatPrice(trade.fill_price || trade.entry_price)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">SL (1R)</p>
                      <p className="font-mono text-sm text-red-400">
                        ${formatPrice(trade.stop_loss)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">TP1 (2R)</p>
                      <p className="font-mono text-sm text-emerald-400">
                        ${formatPrice(trade.take_profit_1)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500">TP2 (3R)</p>
                      <p className="font-mono text-sm text-green-400">
                        ${formatPrice(trade.take_profit_2)}
                      </p>
                    </div>
                    {trade.pnl !== null && trade.pnl !== undefined && (
                      <div>
                        <p className="text-xs text-zinc-500">P&L</p>
                        <p
                          className={`font-mono text-sm font-semibold ${
                            trade.pnl >= 0 ? "text-emerald-400" : "text-red-400"
                          }`}
                        >
                          {trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedTrade === trade.id && (
                  <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-800/30 p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                      <div>
                        <p className="text-xs text-zinc-500">Quantity</p>
                        <p className="font-mono text-sm text-zinc-300">
                          {trade.quantity.toFixed(6)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Risk Amount</p>
                        <p className="font-mono text-sm text-zinc-300">
                          ${trade.risk_amount.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">R:R</p>
                        <p className="font-mono text-sm text-zinc-300">
                          {trade.risk_reward_ratio}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-zinc-500">Capital</p>
                        <p className="font-mono text-sm text-zinc-300">
                          ${trade.capital}
                        </p>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">AI Reasoning</p>
                      <p className="text-sm text-zinc-300 leading-relaxed">
                        {trade.ai_reasoning}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-zinc-500 mb-1">Summary</p>
                      <p className="text-sm text-zinc-400">
                        {trade.analysis_summary}
                      </p>
                    </div>
                    {trade.order_id && (
                      <p className="text-xs text-zinc-600">
                        Order ID: {trade.order_id}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  color = "text-white",
}: {
  label: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className={`mt-1 font-mono text-lg font-semibold ${color}`}>
        {value}
      </p>
    </div>
  );
}
