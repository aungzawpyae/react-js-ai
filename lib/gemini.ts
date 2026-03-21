import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function analyzeCoin(
  symbol: string,
  klineData: { open: string; high: string; low: string; close: string; volume: string }[],
  currentPrice: string
): Promise<string> {
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
  });

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

  const result = await model.generateContent(prompt);
  return result.response.text();
}
