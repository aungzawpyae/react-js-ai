"use client";

import { useEffect, useRef } from "react";
import type { KlineData } from "@/lib/binance";

export default function PriceChart({ klines }: { klines: KlineData[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || klines.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = { top: 20, right: 10, bottom: 30, left: 70 };
    const chartW = width - padding.left - padding.right;
    const chartH = height - padding.top - padding.bottom;

    const prices = klines.flatMap((k) => [parseFloat(k.high), parseFloat(k.low)]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice || 1;

    ctx.clearRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = "rgba(63, 63, 70, 0.3)";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (chartH / 4) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      const price = maxPrice - (priceRange / 4) * i;
      ctx.fillStyle = "#71717a";
      ctx.font = "11px monospace";
      ctx.textAlign = "right";
      ctx.fillText("$" + price.toFixed(2), padding.left - 8, y + 4);
    }

    // Candlesticks
    const candleWidth = Math.max(1, (chartW / klines.length) * 0.6);
    const gap = chartW / klines.length;

    klines.forEach((k, i) => {
      const open = parseFloat(k.open);
      const close = parseFloat(k.close);
      const high = parseFloat(k.high);
      const low = parseFloat(k.low);
      const isGreen = close >= open;

      const x = padding.left + gap * i + gap / 2;
      const yHigh = padding.top + ((maxPrice - high) / priceRange) * chartH;
      const yLow = padding.top + ((maxPrice - low) / priceRange) * chartH;
      const yOpen = padding.top + ((maxPrice - open) / priceRange) * chartH;
      const yClose = padding.top + ((maxPrice - close) / priceRange) * chartH;

      // Wick
      ctx.strokeStyle = isGreen ? "#34d399" : "#f87171";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, yHigh);
      ctx.lineTo(x, yLow);
      ctx.stroke();

      // Body
      ctx.fillStyle = isGreen ? "#34d399" : "#f87171";
      const bodyTop = Math.min(yOpen, yClose);
      const bodyHeight = Math.max(Math.abs(yClose - yOpen), 1);
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight);
    });
  }, [klines]);

  return (
    <canvas
      ref={canvasRef}
      className="h-64 w-full sm:h-80"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
