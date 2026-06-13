import { useReadContract } from "wagmi";
import { VAULT_ADDRESS, VAULT_ABI } from "../wagmi";
import { useAccount } from "wagmi";

export default function PositionCard() {
  const { address } = useAccount();

  const { data: hf } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "getHealthFactor",
  });

  const { data: policy } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "getPolicy",
  });

  const healthFactor = hf ? (Number(hf) / 1e18).toFixed(4) : "—";
  const hfColor =
    !hf ? "text-slate-400"
    : Number(hf) / 1e18 >= 2   ? "text-emerald-500"
    : Number(hf) / 1e18 >= 1.5 ? "text-amber-500"
    : "text-rose-500";

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Aave position</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-950">Overview</h3>
        </div>
        <p className="text-sm text-slate-500">{address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "No wallet"}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Health factor" value={healthFactor} valueClass={hfColor} />
        <Stat label="Max tx" value={policy ? `${Number(policy[2]) / 1e6} USDC` : "—"} />
        <Stat label="Cooldown" value={policy ? `${Number(policy[3]) / 60}m` : "—"} />
      </div>

      <p className="mt-6 text-sm text-slate-500">Position data is retrieved live from the vault contract and Aave / Base Sepolia.</p>
    </div>
  );
}

function Stat({ label, value, valueClass = "text-slate-900" }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className={`mt-3 text-2xl font-semibold ${valueClass}`}>{value}</p>
    </div>
  );
}
