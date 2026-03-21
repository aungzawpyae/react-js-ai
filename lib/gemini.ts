const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const GEMINI_BASE_URL =
  process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta";

export async function analyzeCoin(
  symbol: string,
  klineData: { open: string; high: string; low: string; close: string; volume: string }[],
  currentPrice: string
): Promise<string> {
  const recentKlines = klineData.slice(-24);
  const priceHistory = recentKlines
    .map(
      (k, i) =>
        `${i + 1}. O:${parseFloat(k.open).toFixed(2)} H:${parseFloat(k.high).toFixed(2)} L:${parseFloat(k.low).toFixed(2)} C:${parseFloat(k.close).toFixed(2)} V:${parseFloat(k.volume).toFixed(2)}`
    )
    .join("\n");

  const prompt = `You are a professional crypto trading analyst. Analyze the following data for ${symbol}:

Current Price: $${currentPrice}

Last 24 hourly candles (OHLCV):
${priceHistory}

Provide a concise analysis including:
1. **Trend**: Current trend direction and strength
2. **Support & Resistance**: Key price levels
3. **Volume Analysis**: Volume pattern interpretation
4. **Indicators**: RSI estimate, momentum signals
5. **Signal**: BUY / SELL / HOLD recommendation with confidence level
6. **Risk**: Key risks and suggested stop-loss level

Keep the analysis focused and actionable. Format with markdown.`;

  const res = await fetch(
    `${GEMINI_BASE_URL}/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API error: ${err}`);
  }

  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "No analysis generated.";
}
