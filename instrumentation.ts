export async function register() {
  // Only run the trading agent background job on Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startTradingAgent } = await import("./lib/trading-cron");
    startTradingAgent();
  }
}
