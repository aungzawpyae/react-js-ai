export function formatPrice(price: string | number | undefined | null): string {
  if (price == null || price === "") return "0.00";
  const num = typeof price === "string" ? parseFloat(price) : price;
  if (isNaN(num)) return "0.00";
  if (num >= 1000) return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (num >= 1) return num.toFixed(2);
  if (num >= 0.01) return num.toFixed(4);
  return num.toFixed(6);
}

export function formatVolume(volume: string | number | undefined | null): string {
  if (volume == null || volume === "") return "0";
  const num = typeof volume === "string" ? parseFloat(volume) : volume;
  if (isNaN(num)) return "0";
  if (num >= 1_000_000_000) return (num / 1_000_000_000).toFixed(2) + "B";
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(2) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(2) + "K";
  return num.toFixed(2);
}

export function formatPercent(percent: string | number | undefined | null): string {
  if (percent == null || percent === "") return "+0.00%";
  const num = typeof percent === "string" ? parseFloat(percent) : percent;
  if (isNaN(num)) return "+0.00%";
  return (num >= 0 ? "+" : "") + num.toFixed(2) + "%";
}

export function getCoinName(symbol: string): string {
  return symbol.replace("USDT", "");
}
