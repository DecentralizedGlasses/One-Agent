import { useEffect, useState } from "react";
import VaultModal from "./VaultModal";

const AGENT_URL = import.meta.env.VITE_AGENT_URL || "http://localhost:3001";

export default function StatsRow({ position, log }) {
  const today        = new Date().setHours(0, 0, 0, 0);
  const todayLog     = log.filter(e => e.ts >= today);
  const actionsToday = todayLog.length;
  const blockedToday = todayLog.filter(e => e.status === "blocked").length;

  const hf      = position?.healthFactor ?? null;
  const noDebt  = position && position.totalCollateralUSD > 0 && !position.totalDebtUSD;
  const hfStr   = hf !== null ? hf.toFixed(2) : noDebt ? "∞" : "—";
  const hfColor = hf === null
    ? noDebt ? "text-green-700 dark:text-green-400" : "text-gray-400 dark:text-slate-500"
    : hf >= 2 ? "text-green-700 dark:text-green-400"
    : hf >= 1.5 ? "text-yellow-600 dark:text-yellow-400"
    : "text-red-600 dark:text-red-400";

  const [vaultUsdc, setVaultUsdc] = useState(null);
  const [modal,     setModal]     = useState(null); // "fund" | "withdraw" | null

  async function fetchVaultInfo() {
    const res = await fetch(`${AGENT_URL}/vault-info`).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      if (!data.error) setVaultUsdc(data.usdcBalance ?? null);
    }
  }

  useEffect(() => {
    fetchVaultInfo();
    const id = setInterval(fetchVaultInfo, 15000);
    return () => clearInterval(id);
  }, []);

  const vaultUsdcStr   = vaultUsdc !== null ? `$${vaultUsdc.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—";
  const vaultUsdcColor = vaultUsdc === null ? "text-gray-400 dark:text-slate-500" : vaultUsdc > 0 ? "text-green-700 dark:text-green-400" : "text-red-500 dark:text-red-400";

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard
          label="Total supplied"
          value={position ? `$${position.totalCollateralUSD.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
          valueClass="text-blue-600 dark:text-blue-400"
        />
        <StatCard label="Health factor" value={hfStr} valueClass={hfColor} />

        {/* Vault USDC card — has Fund + Withdraw buttons */}
        <div className="glass-card rounded-2xl border border-gray-200 dark:border-slate-700 px-5 py-4">
          <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">Vault USDC</p>
          <p className={`text-3xl font-bold ${vaultUsdcColor} mb-2`}>{vaultUsdcStr}</p>
          {vaultUsdc === 0 && (
            <p className="text-xs text-orange-500 mb-2">fund to enable agent</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => setModal("fund")}
              className="flex-1 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition"
            >
              Fund
            </button>
            <button
              onClick={() => setModal("withdraw")}
              disabled={!vaultUsdc || vaultUsdc <= 0}
              className="flex-1 py-1 rounded-lg bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 text-xs font-semibold transition disabled:opacity-40"
            >
              Withdraw
            </button>
          </div>
        </div>

        <StatCard
          label="Actions today"
          value={actionsToday}
          valueClass="text-indigo-600 dark:text-indigo-400"
        />
        <StatCard
          label="Blocked today"
          value={blockedToday}
          valueClass={blockedToday > 0 ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-slate-100"}
        />
      </div>

      {modal && (
        <VaultModal
          mode={modal}
          vaultUsdc={vaultUsdc}
          onClose={() => setModal(null)}
          onSuccess={fetchVaultInfo}
        />
      )}
    </>
  );
}

function StatCard({ label, value, valueClass = "text-gray-900 dark:text-slate-100", sub }) {
  return (
    <div className="glass-card rounded-2xl border border-gray-200 dark:border-slate-700 px-5 py-4">
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${valueClass}`}>{value}</p>
      {sub && <p className="text-xs text-orange-500 mt-1">{sub}</p>}
    </div>
  );
}
