import { useEffect, useState } from "react";

const AGENT_URL = import.meta.env.VITE_AGENT_URL || "http://localhost:3001";

export default function StatsRow({ position, log }) {
  const today = new Date().setHours(0, 0, 0, 0);
  const todayLog     = log.filter(e => e.ts >= today);
  const actionsToday = todayLog.length;
  const blockedToday = todayLog.filter(e => e.status === "blocked").length;

  const hf      = position?.healthFactor ?? null;
  const hfStr   = hf !== null ? hf.toFixed(2) : "—";
  const hfColor = hf === null ? "text-gray-400" : hf >= 2 ? "text-green-700" : hf >= 1.5 ? "text-yellow-600" : "text-red-600";

  const [vaultUsdc, setVaultUsdc] = useState(null);

  useEffect(() => {
    async function fetchVaultInfo() {
      const res = await fetch(`${AGENT_URL}/vault-info`).catch(() => null);
      if (res?.ok) {
        const data = await res.json();
        if (!data.error) setVaultUsdc(data.usdcBalance ?? null);
      }
    }
    fetchVaultInfo();
    const id = setInterval(fetchVaultInfo, 15000);
    return () => clearInterval(id);
  }, []);

  const vaultUsdcStr   = vaultUsdc !== null ? `$${vaultUsdc.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—";
  const vaultUsdcColor = vaultUsdc === null ? "text-gray-400" : vaultUsdc > 0 ? "text-green-700" : "text-red-500";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        label="Total supplied"
        value={position ? `$${position.totalCollateralUSD.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
        valueClass="text-blue-600"
      />
      <StatCard
        label="Health factor"
        value={hfStr}
        valueClass={hfColor}
      />
      <StatCard
        label="Vault USDC"
        value={vaultUsdcStr}
        valueClass={vaultUsdcColor}
        sub={vaultUsdc === 0 ? "fund to enable agent" : undefined}
      />
      <StatCard label="Blocked today" value={blockedToday} valueClass={blockedToday > 0 ? "text-red-600" : "text-gray-900"} />
    </div>
  );
}

function StatCard({ label, value, valueClass = "text-gray-900", sub }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-orange-500 mt-1">{sub}</p>}
    </div>
  );
}
