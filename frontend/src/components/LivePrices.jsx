import { useState, useEffect } from "react";

const AGENT_URL = import.meta.env.VITE_AGENT_URL || "http://localhost:3001";

// Derived from ETH/USD (Chainlink) and USDC/USD (Aave oracle)
function buildRows({ ethUsd, usdcUsd }) {
  // USDT has no Aave listing on Base Sepolia testnet — treat as $1.00 peg
  const usdtUsd = 1.0;
  const ethUsdc = usdcUsd > 0 ? ethUsd / usdcUsd : ethUsd;
  const ethUsdt = ethUsd / usdtUsd;

  return [
    {
      label:   "ETH / USDC",
      price:   ethUsdc.toFixed(2),
      source:  "Chainlink + Aave",
      note:    null,
    },
    {
      label:   "ETH / USDT",
      price:   ethUsdt.toFixed(2),
      source:  "Chainlink",
      note:    "USDT peg assumed $1",
    },
    {
      label:   "USDC / USD",
      price:   usdcUsd.toFixed(4),
      source:  "Aave oracle",
      note:    null,
    },
    {
      label:   "USDT / USD",
      price:   usdtUsd.toFixed(4),
      source:  "peg",
      note:    "No USDT feed on Base Sepolia",
    },
  ];
}

export default function LivePrices() {
  const [data,    setData]    = useState(null);
  const [error,   setError]   = useState(false);
  const [pulse,   setPulse]   = useState(false);
  const [updated, setUpdated] = useState(null);

  async function refresh() {
    try {
      const res = await fetch(`${AGENT_URL}/prices`);
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      setData(json);
      setError(false);
      setPulse(true);
      setUpdated(new Date());
      setTimeout(() => setPulse(false), 600);
    } catch {
      setError(true);
    }
  }

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, []);

  const rows = data ? buildRows(data) : null;

  return (
    <div className="glass-card rounded-2xl border border-gray-200 dark:border-slate-700 p-5 sticky top-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="relative flex h-2 w-2">
          <span className={`absolute inline-flex h-full w-full rounded-full opacity-75 ${error ? "hidden" : "animate-ping bg-green-400"}`} />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${error ? "bg-red-400" : "bg-green-500"}`} />
        </span>
        <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Live Prices</h2>
        <span className="ml-auto text-[10px] text-gray-400 dark:text-slate-500">
          {error ? "agent offline" : updated
            ? updated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
            : "loading…"}
        </span>
      </div>

      {/* Price cards */}
      <div className="space-y-3">
        {rows
          ? rows.map(row => <PriceCard key={row.label} row={row} pulse={pulse} />)
          : Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        }
      </div>

      {/* Source note */}
      <div className="mt-4 pt-3 border-t border-gray-100 dark:border-slate-800">
        <p className="text-[10px] text-gray-300 dark:text-slate-600">
          ETH/USD via Chainlink · USDC/USD via Aave oracle · Base Sepolia · updates every 15s
        </p>
        {data?.updatedAt && (
          <p className="text-[10px] text-gray-300 dark:text-slate-600 mt-0.5">
            Feed timestamp: {new Date(data.updatedAt * 1000).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
}

function PriceCard({ row, pulse }) {
  return (
    <div className={`rounded-xl border px-4 py-3 transition-colors duration-300 ${
      pulse
        ? "border-blue-300 dark:border-blue-600 bg-blue-50 dark:bg-blue-950"
        : "border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800"
    }`}>
      {/* Label + source */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-500 dark:text-slate-400 tracking-wide">
          {row.label}
        </span>
        <span className="text-[10px] text-gray-300 dark:text-slate-600 font-medium">
          {row.source}
        </span>
      </div>

      {/* Price */}
      <p className="text-xl font-bold text-gray-900 dark:text-slate-100 font-mono tracking-tight">
        ${row.price}
      </p>

      {/* Note for peg / assumptions */}
      {row.note && (
        <p className="mt-1 text-[10px] text-amber-500 dark:text-amber-400">{row.note}</p>
      )}
    </div>
  );
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-4 py-3 animate-pulse">
      <div className="flex justify-between mb-2">
        <div className="h-3 w-20 bg-gray-200 dark:bg-slate-700 rounded" />
        <div className="h-3 w-12 bg-gray-200 dark:bg-slate-700 rounded" />
      </div>
      <div className="h-6 w-24 bg-gray-200 dark:bg-slate-700 rounded" />
    </div>
  );
}
