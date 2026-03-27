import { runTradingAgent } from "./trading-agent";

const INTERVAL_MS = 60 * 1000; // Every 1 minute
let isRunning = false;
let intervalId: ReturnType<typeof setInterval> | null = null;

async function tick() {
  if (isRunning) {
    console.log("[Trading Agent] Previous run still in progress, skipping...");
    return;
  }

  isRunning = true;
  const start = Date.now();

  try {
    console.log("[Trading Agent] Running analysis for BTC, ETH, SOL...");
    const result = await runTradingAgent();

    const summary = result.results
      .map((r) => `${r.symbol}: ${r.signal} (${r.action})`)
      .join(" | ");

    console.log(
      `[Trading Agent] Done in ${((Date.now() - start) / 1000).toFixed(1)}s | ${summary}`
    );

    if (result.monitoring.length > 0) {
      console.log(
        `[Trading Agent] Monitoring: ${result.monitoring.join(", ")}`
      );
    }
  } catch (error) {
    console.error(
      "[Trading Agent] Error:",
      error instanceof Error ? error.message : error
    );
  } finally {
    isRunning = false;
  }
}

export function startTradingAgent() {
  if (intervalId) {
    console.log("[Trading Agent] Already running, skipping duplicate start");
    return;
  }

  console.log("[Trading Agent] Starting background cron (every 1 minute)");
  console.log("[Trading Agent] Coins: BTCUSDT, ETHUSDT, SOLUSDT");
  console.log("[Trading Agent] Capital: $100 | Risk: 1R SL, 2R/3R TP");

  // Run immediately on start, then every minute
  tick();
  intervalId = setInterval(tick, INTERVAL_MS);
}
