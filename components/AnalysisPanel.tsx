"use client";

import { useState } from "react";

export default function AnalysisPanel({ symbol }: { symbol: string }) {
  const [analysis, setAnalysis] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runAnalysis() {
    setLoading(true);
    setError(null);
    try {
      // Fetch Binance data client-side (avoids Vercel IP blocking)
      const [tickerRes, klinesRes] = await Promise.all([
        fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`),
        fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=100`),
      ]);
      const ticker = await tickerRes.json();
      const rawKlines = await klinesRes.json();
      const klines = rawKlines.map((k: (string | number)[]) => ({
        open: k[1], high: k[2], low: k[3], close: k[4], volume: k[5],
      }));

      const res = await fetch("/api/analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, klines, currentPrice: ticker.lastPrice }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Analysis failed");
      }

      const data = await res.json();
      setAnalysis(data.analysis);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">AI Analysis</h2>
        <button
          onClick={runAnalysis}
          disabled={loading}
          className="rounded-xl bg-gradient-to-r from-yellow-500 to-orange-500 px-6 py-2.5 text-sm font-semibold text-black transition-all hover:from-yellow-400 hover:to-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Analyzing...
            </span>
          ) : (
            "Analyze with AI"
          )}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
          {error}
        </div>
      )}

      {analysis && (
        <div className="prose prose-invert max-w-none text-sm">
          <div
            className="space-y-3 leading-relaxed text-zinc-300 [&>h1]:text-lg [&>h1]:font-bold [&>h1]:text-white [&>h2]:text-base [&>h2]:font-semibold [&>h2]:text-white [&>p>strong]:text-yellow-400 [&>ul]:list-disc [&>ul]:pl-5 [&>ol]:list-decimal [&>ol]:pl-5"
            dangerouslySetInnerHTML={{ __html: markdownToHtml(analysis) }}
          />
        </div>
      )}

      {!analysis && !loading && !error && (
        <p className="text-sm text-zinc-500">
          Click &quot;Analyze with AI&quot; to get a Gemini-powered technical analysis
          of {symbol}.
        </p>
      )}
    </div>
  );
}

function markdownToHtml(md: string): string {
  return md
    .replace(/^### (.+)$/gm, '<h2 class="mt-4 mb-2">$1</h2>')
    .replace(/^## (.+)$/gm, '<h2 class="mt-4 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="mt-4 mb-2">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/^(\d+)\. (.+)$/gm, "<li>$2</li>")
    .replace(new RegExp("(<li>.*</li>)", "s"), "<ul>$1</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br/>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>");
}
