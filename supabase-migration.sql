-- Trading Journal Table for Auto Trading Agent
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS trading_journal (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK (side IN ('BUY', 'SELL')),
  signal TEXT NOT NULL,
  confidence INTEGER,
  entry_price DECIMAL NOT NULL,
  stop_loss DECIMAL NOT NULL,
  take_profit_1 DECIMAL NOT NULL,
  take_profit_2 DECIMAL NOT NULL,
  quantity DECIMAL NOT NULL,
  risk_amount DECIMAL NOT NULL,
  risk_reward_ratio TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'OPEN', 'TP1_HIT', 'TP2_HIT', 'SL_HIT', 'CLOSED', 'CANCELLED', 'ERROR')),
  order_id TEXT,
  sl_order_id TEXT,
  tp1_order_id TEXT,
  tp2_order_id TEXT,
  fill_price DECIMAL,
  close_price DECIMAL,
  pnl DECIMAL,
  pnl_percent DECIMAL,
  analysis_summary TEXT,
  ai_reasoning TEXT,
  timeframe TEXT DEFAULT '1d',
  capital DECIMAL DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ
);

-- Index for quick lookups
CREATE INDEX idx_trading_journal_symbol ON trading_journal(symbol);
CREATE INDEX idx_trading_journal_status ON trading_journal(status);
CREATE INDEX idx_trading_journal_created ON trading_journal(created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trading_journal_updated
  BEFORE UPDATE ON trading_journal
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- Trade stats view
CREATE OR REPLACE VIEW trade_stats AS
SELECT
  COUNT(*) AS total_trades,
  COUNT(*) FILTER (WHERE status IN ('TP1_HIT', 'TP2_HIT')) AS winning_trades,
  COUNT(*) FILTER (WHERE status = 'SL_HIT') AS losing_trades,
  COUNT(*) FILTER (WHERE status IN ('OPEN', 'PENDING')) AS active_trades,
  COALESCE(SUM(pnl), 0) AS total_pnl,
  COALESCE(AVG(pnl_percent) FILTER (WHERE pnl IS NOT NULL), 0) AS avg_pnl_percent,
  CASE
    WHEN COUNT(*) FILTER (WHERE status IN ('TP1_HIT', 'TP2_HIT', 'SL_HIT')) > 0
    THEN ROUND(COUNT(*) FILTER (WHERE status IN ('TP1_HIT', 'TP2_HIT'))::DECIMAL /
         COUNT(*) FILTER (WHERE status IN ('TP1_HIT', 'TP2_HIT', 'SL_HIT')) * 100, 1)
    ELSE 0
  END AS win_rate
FROM trading_journal;
