# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

- **Dev server:** `pnpm dev` (http://localhost:3000)
- **Build:** `pnpm build`
- **Start production:** `pnpm start`
- **Lint:** `pnpm lint` (ESLint 9 flat config with next/core-web-vitals + typescript)

## Tech Stack

- Next.js 16 App Router (TypeScript) with Turbopack
- React 19
- Tailwind CSS 4 (via PostCSS)
- pnpm package manager
- Supabase (database/auth)
- Binance API (REST + WebSocket for real-time market data)
- Google Gemini AI (gemini-2.0-flash for crypto analysis)
- Telegram Bot API (notifications)

## Architecture

### Data Flow

```
Binance WebSocket (wss://stream.binance.com) --> Client components (real-time price updates)
Binance REST API (testnet) --> Server components & API routes (initial data, klines)
Gemini AI --> /api/analysis route --> AnalysisPanel component
Telegram Bot --> /api/telegram route
```

### Key Directories

- `app/` — Next.js App Router pages and API routes
  - `app/api/coins/` — Binance ticker data endpoint
  - `app/api/analysis/` — Gemini AI analysis endpoint (POST with `{ symbol }`)
  - `app/api/telegram/` — Telegram message sending endpoint
  - `app/coin/[symbol]/` — Dynamic coin detail page
- `components/` — Client components (CoinList, CoinCard, LivePrice, PriceChart, AnalysisPanel)
- `lib/` — API clients and utilities
  - `binance.ts` — Binance REST API (tickers, klines, price)
  - `gemini.ts` — Gemini AI analysis with trading-focused prompts
  - `supabase.ts` — Supabase client
  - `telegram.ts` — Telegram bot messaging
  - `format.ts` — Price/volume/percent formatting helpers
  - `types.ts` — Shared TypeScript interfaces (CoinTicker, WsTicker, MiniTicker)

### Real-Time Data Pattern

- Home page: Server-fetches initial top 50 USDT tickers, then `CoinList` connects to `!miniTicker@arr` WebSocket for live updates
- Coin detail: Server-fetches ticker + klines, then `LivePrice` connects to `{symbol}@ticker` WebSocket for live price

### Environment Variables

All secrets are in `.env.local` (gitignored). Required:
- `SUPABASE_URL`, `SUPABASE_KEY`
- `BINANCE_API_KEY`, `BINANCE_API_SECRET`, `BINANCE_BASE_URL`
- `GEMINI_API_KEY`, `GEMINI_MODEL`, `GEMINI_BASE_URL`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`

### Conventions

- `@/*` path alias maps to project root
- Dark theme only (black background, zinc/yellow/orange accent palette)
- `params` in Next.js 16 page components are Promises — must be awaited
- Canvas-based candlestick chart (no chart library dependency)
