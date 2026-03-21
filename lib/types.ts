export interface CoinTicker {
  symbol: string;
  price: string;
  priceChangePercent: string;
  volume: string;
  high: string;
  low: string;
  quoteVolume: string;
}

export interface WsTicker {
  s: string; // symbol
  c: string; // close price
  P: string; // price change percent
  v: string; // volume
  h: string; // high
  l: string; // low
  q: string; // quote volume
}

export interface MiniTicker {
  s: string;
  c: string;
  o: string;
  h: string;
  l: string;
  v: string;
  q: string;
}
