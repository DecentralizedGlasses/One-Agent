import { useEffect, useState } from "react";
import { useReadContract } from "wagmi";
import { VAULT_ADDRESS, VAULT_ABI, VAULT_CHAIN_ID } from "../wagmi";

const AGENT_URL = import.meta.env.VITE_AGENT_URL || "http://localhost:3001";

export default function PositionCard() {
  const [livePosition, setLivePosition] = useState(null);
  const [loading, setLoading] = useState(true);

  const { data: hf } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "getHealthFactor",
    chainId: VAULT_CHAIN_ID,
  });

  const { data: policy } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "getPolicy",
    chainId: VAULT_CHAIN_ID,
  });

  useEffect(() => {
    let cancelled = false;
    async function fetchPosition() {
      try {
        const res = await fetch(`${AGENT_URL}/position`);
        const data = await res.json();
        if (!cancelled) setLivePosition(data);
      } catch {
        // agent not running — fall back to on-chain health factor only
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchPosition();
    const id = setInterval(fetchPosition, 15000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const healthFactor = livePosition?.healthFactor
    ? livePosition.healthFactor.toFixed(4)
    : hf
      ? (Number(hf) / 1e18).toFixed(4)
      : "—";

  const hfNum = livePosition?.healthFactor ?? (hf ? Number(hf) / 1e18 : null);
  const hfColor =
    hfNum === null ? "text-gray-400 dark:text-slate-400"
    : hfNum >= 2   ? "text-green-500"
    : hfNum >= 1.5 ? "text-yellow-500"
    : "text-red-500";

  const fmt = (n) => n !== undefined && n !== null ? `$${n.toFixed(2)}` : "—";

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-5 space-y-4 border border-gray-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Aave Position</h2>
        {livePosition?._mock && (
          <span className="text-xs bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-200 px-2 py-1 rounded">MOCK</span>
        )}
        {loading && !livePosition && (
          <span className="text-xs text-gray-400 dark:text-slate-500">loading…</span>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Stat label="Health Factor" value={healthFactor} valueClass={hfColor} />
        <Stat label="Collateral"    value={fmt(livePosition?.totalCollateralUSD)} />
        <Stat label="Debt"          value={fmt(livePosition?.totalDebtUSD)} />
        <Stat label="Available"     value={fmt(livePosition?.availableBorrowsUSD)} />
      </div>

      <div className="border-t border-gray-100 dark:border-slate-800 pt-3 grid grid-cols-2 gap-4">
        <Stat label="Max Tx"   value={policy ? `${Number(policy[2]) / 1e6} USDC` : "—"} small />
        <Stat label="Cooldown" value={policy ? `${Number(policy[3]) / 60}m`        : "—"} small />
      </div>

      <p className="text-xs text-gray-400 dark:text-slate-500">
        Live from Aave v3 · Base Sepolia · refreshes every 15s
      </p>
    </div>
  );
}

function Stat({ label, value, valueClass = "text-gray-900 dark:text-slate-100", small = false }) {
  return (
    <div>
      <p className="text-xs text-gray-400 dark:text-slate-500">{label}</p>
      <p className={`font-bold ${small ? "text-base" : "text-xl"} ${valueClass}`}>{value}</p>
    </div>
  );
}
