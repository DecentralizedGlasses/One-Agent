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
    !hf ? "text-gray-400"
    : Number(hf) / 1e18 >= 2   ? "text-green-600"
    : Number(hf) / 1e18 >= 1.5 ? "text-yellow-600"
    : "text-red-600";

  return (
    <div className="bg-white rounded-xl p-5 space-y-4 border border-gray-200 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Aave Position</h2>

      <div className="grid grid-cols-3 gap-4">
        <Stat label="Health Factor" value={healthFactor} valueClass={hfColor} />
        <Stat label="Max Tx" value={policy ? `${Number(policy[2]) / 1e6} USDC` : "—"} />
        <Stat label="Cooldown" value={policy ? `${Number(policy[3]) / 60}m` : "—"} />
      </div>

      {/* TODO: pull live collateral/debt from agent /position endpoint */}
      <p className="text-xs text-gray-400">Position data via Aave v3 on Base Sepolia</p>
    </div>
  );
}

function Stat({ label, value, valueClass = "text-gray-900" }) {
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className={`text-xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}
