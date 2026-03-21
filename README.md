# CryptoTrader

Real-time cryptocurrency trading dashboard with AI-powered analysis. Built with Next.js 16, React 19, and Tailwind CSS 4.

## Features

- **Real-Time Market Data** — Top 50 USDT pairs streamed live via Binance WebSocket
- **Coin Detail View** — Live price updates, 24h stats, and candlestick chart
- **AI Analysis** — One-click Gemini AI technical analysis with trend, support/resistance, and BUY/SELL/HOLD signals
- **Telegram Notifications** — Send alerts via Telegram Bot API
- **Supabase Backend** — Database and auth integration

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS 4 |
| Market Data | Binance REST + WebSocket API |
| AI | Google Gemini 2.0 Flash |
| Database | Supabase |
| Notifications | Telegram Bot API |
| Language | TypeScript |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm

### Setup

1. Clone the repository:

```bash
git clone git@github.com:aungzawpyae/react-js-ai.git
cd react-js-ai
```

2. Install dependencies:

```bash
pnpm install
```

3. Create `.env.local` with the following variables:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key

BINANCE_API_KEY=your_binance_api_key
BINANCE_API_SECRET=your_binance_api_secret
BINANCE_BASE_URL=https://testnet.binance.vision
BINANCE_FUTURES_BASE_URL=https://testnet.binancefuture.com
BINANCE_WS_URL=wss://stream.binance.com:9443/ws

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=gemini-2.0-flash
GEMINI_BASE_URL=https://generativelanguage.googleapis.com/v1beta

TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

4. Run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
app/
  page.tsx                  # Home — real-time coin list
  coin/[symbol]/page.tsx    # Coin detail — chart + AI analysis
  api/
    coins/route.ts          # Binance ticker data
    analysis/route.ts       # Gemini AI analysis
    telegram/route.ts       # Telegram notifications
components/
  CoinList.tsx              # Live-updating coin grid
  CoinCard.tsx              # Individual coin card
  LivePrice.tsx             # Real-time price with flash animation
  PriceChart.tsx            # Canvas candlestick chart
  AnalysisPanel.tsx         # AI analysis panel
lib/
  binance.ts                # Binance API client
  gemini.ts                 # Gemini AI client
  supabase.ts               # Supabase client
  telegram.ts               # Telegram Bot client
  format.ts                 # Price/volume formatters
  types.ts                  # TypeScript interfaces
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm lint` | Run ESLint |
