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

interface AgentResult {
  symbol: string;
  signal: string;
  confidence: number;
  action: string;
  reason: string;
  analysis: string;
}

interface AgentResponse {
  results: AgentResult[];
  monitoring: string[];
  riskCheck: {
    canTrade: boolean;
    reason: string;
    openTrades: number;
    consecutiveLosses: number;
  };
  timestamp: string;
}

export default function AutoTradePanel() {
  const [journal, setJournal] = useState<TradeEntry[]>([]);
  const [stats, setStats] = useState<TradeStats | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [autoMode, setAutoMode] = useState(false);
  const [lastRun, setLastRun] = useState<AgentResponse | null>(null);
  const [error, setError] = useState("");
  const [expandedTrade, setExpandedTrade] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(60);

  const fetchData = useCallback(async () => {
    try {
      const [journalRes, statsRes] = await Promise.all([
        fetch("/api/auto-trade?type=journal&limit=20"),
        fetch("/api/auto-trade?type=stats"),
      ]);
      if (journalRes.ok) setJournal(await journalRes.json());
      if (statsRes.ok) setStats(await statsRes.json());
    } catch {
      // silent
    }
  }, []);

  const runAgent = useCallback(async () => {
    setIsRunning(true);
    setError("");
    try {
      const res = await fetch("/api/auto-trade", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Agent failed");
      setLastRun(data);
      await fetchData();
      setCountdown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsRunning(false);
    }
  }, [fetchData]);

  // Initial data fetch
  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto mode - run every 60 seconds
  useEffect(() => {
    if (!autoMode) return;
    const interval = setInterval(() => {
      runAgent();
    }, 60000);
    return () => clearInterval(interval);
  }, [autoMode, runAgent]);

  // Countdown timer
  useEffect(() => {
    if (!autoMode) return;
    const timer = setInterval(() => {
      setCountdown((c) => (c <= 1 ? 60 : c - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [autoMode]);

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

  const signalColor = (signal: string) => {
    if (signal === "BUY") return "text-emerald-400";
    if (signal === "SELL") return "text-red-400";
    return "text-zinc-400";
  };

  return (
    <div className="space-y-6">
      {/* Control Panel */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">
              Trading Agent Control
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              BTC, ETH, SOL | Daily TF | $100 Capital | 1R SL, 2R/3R TP
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Auto Mode Toggle */}
            <button
              onClick={() => {
                setAutoMode(!autoMode);
                if (!autoMode) {
                  setCountdown(60);
                  runAgent();
                }
              }}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                autoMode
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  autoMode ? "bg-emerald-400 animate-pulse" : "bg-zinc-500"
                }`}
              />
              {autoMode ? `Auto ON (${countdown}s)` : "Auto OFF"}
            </button>

            {/* Manual Run */}
            <button
              onClick={runAgent}
              disabled={isRunning}
              className="rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 px-5 py-2.5 text-sm font-semibold text-black transition-all hover:from-yellow-400 hover:to-orange-400 disabled:opacity-50"
            >
              {isRunning ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="h-4 w-4 animate-spin"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="opacity-25"
                    />
                    <path
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      fill="currentColor"
                      className="opacity-75"
                    />
                  </svg>
                  Analyzing...
                </span>
              ) : (
                "Run Agent Now"
              )}
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Last Run Results */}
        {lastRun && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <span>Last run: {new Date(lastRun.timestamp).toLocaleString()}</span>
              <span className={lastRun.riskCheck.canTrade ? "text-emerald-400" : "text-red-400"}>
                | Risk: {lastRun.riskCheck.reason}
              </span>
              <span>| Open: {lastRun.riskCheck.openTrades}</span>
              <span>| Losses streak: {lastRun.riskCheck.consecutiveLosses}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {lastRun.results.map((r) => (
                <div
                  key={r.symbol}
                  className="rounded-xl border border-zinc-800 bg-zinc-800/50 p-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-semibold text-white">
                      {r.symbol.replace("USDT", "")}
                    </span>
                    <span className={`text-xs font-medium ${signalColor(r.signal)}`}>
                      {r.signal} {r.confidence > 0 && `${r.confidence}%`}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-zinc-500 line-clamp-2">
                    {r.reason || r.action}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
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
            No trades yet. Run the agent to start trading.
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
