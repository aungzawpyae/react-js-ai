"use client";

import { useEffect, useState } from "react";
import { formatPrice, formatPercent } from "@/lib/format";

interface LivePriceProps {
  symbol: string;
  initialPrice: string;
  initialChange: string;
}

export default function LivePrice({
  symbol,
  initialPrice,
  initialChange,
}: LivePriceProps) {
  const [price, setPrice] = useState(initialPrice);
  const [change, setChange] = useState(initialChange);
  const [flash, setFlash] = useState<"up" | "down" | null>(null);

  useEffect(() => {
    const wsSymbol = symbol.toLowerCase();
    const ws = new WebSocket(
      `wss://stream.binance.com:9443/ws/${wsSymbol}@ticker`
    );

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const newPrice = data.c;
      const newChange = data.P;

      setPrice((prev) => {
        if (parseFloat(newPrice) > parseFloat(prev)) setFlash("up");
        else if (parseFloat(newPrice) < parseFloat(prev)) setFlash("down");
        return newPrice;
      });
      setChange(newChange);

      setTimeout(() => setFlash(null), 300);
    };

    return () => ws.close();
  }, [symbol]);

  const isPositive = parseFloat(change) >= 0;

  return (
    <div className="flex items-baseline gap-4">
      <span
        className={`font-mono text-4xl font-bold transition-colors duration-300 ${
          flash === "up"
            ? "text-emerald-400"
            : flash === "down"
              ? "text-red-400"
              : "text-white"
        }`}
      >
        ${formatPrice(price)}
      </span>
      <span
        className={`rounded-lg px-3 py-1 text-sm font-semibold ${
          isPositive
            ? "bg-emerald-500/10 text-emerald-400"
            : "bg-red-500/10 text-red-400"
        }`}
      >
        {formatPercent(change)}
      </span>
    </div>
  );
}
