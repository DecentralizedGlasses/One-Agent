import { useEffect, useState } from "react";

const AGENT_URL = import.meta.env.VITE_AGENT_URL || "http://localhost:3001";

export default function PositionCard({ onPosition }) {
  const [position, setPosition] = useState(null);

  useEffect(() => {
    let cancelled = false;
    async function fetch_() {
      try {
        const res  = await fetch(`${AGENT_URL}/position`);
        const data = await res.json();
        if (!cancelled) { setPosition(data); onPosition?.(data); }
      } catch { /* agent not running */ }
    }
    fetch_();
    const id = setInterval(fetch_, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const collateral = position?.totalCollateralUSD ?? null;
  const debt       = position?.totalDebtUSD ?? null;
  const hf         = position?.healthFactor ?? null;
  const hfPct      = hf !== null ? Math.min((hf / 3) * 100, 100) : 0;
  const hfColor    = hf === null ? "text-gray-400" : hf >= 2 ? "text-green-700" : hf >= 1.5 ? "text-yellow-600" : "text-red-600";
  const barColor   = hf === null ? "bg-gray-300" : hf >= 2 ? "bg-green-700" : hf >= 1.5 ? "bg-yellow-500" : "bg-red-500";

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🏛</span>
        <h2 className="text-base font-semibold text-gray-900">Aave positions</h2>
        {position?._mock && (
          <span className="ml-auto text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full">mock</span>
        )}
      </div>

      {hf !== null && hf < 1.5 && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 border border-red-200">
          <span className="text-base">⚠️</span>
          <div>
            <p className="text-xs font-semibold text-red-700">Liquidation risk — HF {hf.toFixed(2)}</p>
            <p className="text-xs text-red-500">Agent auto-runs every 60s to supply collateral.</p>
          </div>
        </div>
      )}
      {hf !== null && hf >= 1.5 && hf < 1.8 && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-yellow-50 border border-yellow-200">
          <span className="text-base">⚡</span>
          <p className="text-xs font-semibold text-yellow-700">Health factor low — agent auto-runs to add collateral</p>
        </div>
      )}

      <div className="space-y-0 divide-y divide-gray-100">
        <PositionRow
          label="Total collateral"
          value={collateral !== null ? `$${collateral.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—"}
          sub="supplied"
          valueClass="text-gray-900"
        />
        <PositionRow
          label="USDC borrowed"
          value={debt !== null ? `$${debt.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—"}
          sub="debt"
          valueClass="text-red-600"
        />
        <PositionRow
          label="Available to borrow"
          value={position?.availableBorrowsUSD != null ? `$${position.availableBorrowsUSD.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—"}
          sub="liquidity"
          valueClass="text-green-700"
        />
        <div className="py-4 flex items-center justify-between">
          <span className="text-sm text-gray-600">Health factor</span>
          <div className="flex items-center gap-3">
            <div className="w-32 h-2 bg-gray-100 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${hfPct}%` }} />
            </div>
            <span className={`text-sm font-semibold w-10 text-right ${hfColor}`}>
              {hf !== null ? hf.toFixed(2) : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function PositionRow({ label, value, sub, valueClass }) {
  return (
    <div className="py-4 flex items-center justify-between">
      <span className="text-sm text-gray-600">{label}</span>
      <div className="text-right">
        <p className={`text-sm font-semibold ${valueClass}`}>{value}</p>
        <p className="text-xs text-gray-400">{sub}</p>
      </div>
    </div>
  );
}
