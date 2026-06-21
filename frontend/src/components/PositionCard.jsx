import { useEffect } from "react";
import { useAccount, useReadContract } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { parseAbi } from "viem";

const AAVE_POOL = "0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27";
const AAVE_ABI = parseAbi([
  "function getUserAccountData(address user) external view returns (uint256,uint256,uint256,uint256,uint256,uint256)",
]);

const MAX_UINT256 = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");

export default function PositionCard({ onPosition }) {
  const { address, isConnected } = useAccount();

  // Read the connected wallet's Aave position — same address PolicyVault's HF rule monitors
  const { data, isLoading } = useReadContract({
    address: AAVE_POOL,
    abi: AAVE_ABI,
    functionName: "getUserAccountData",
    args: [address],
    chainId: baseSepolia.id,
    query: { enabled: isConnected && !!address, refetchInterval: 15000 },
  });

  const position = data
    ? {
        totalCollateralUSD:  Number(data[0]) / 1e8,
        totalDebtUSD:        Number(data[1]) / 1e8,
        availableBorrowsUSD: Number(data[2]) / 1e8,
        healthFactor: data[5] >= MAX_UINT256 ? null : Number(data[5]) / 1e18,
      }
    : null;

  useEffect(() => {
    if (position) onPosition?.(position);
  }, [data]);

  const collateral  = position?.totalCollateralUSD ?? null;
  const debt        = position?.totalDebtUSD ?? null;
  const hf          = position?.healthFactor ?? null;
  // Aave returns null (MAX_UINT256) when there is no debt — position is infinitely safe
  const noDebt      = collateral !== null && collateral > 0 && (debt === null || debt === 0);
  const hfDisplay   = hf !== null ? hf.toFixed(2) : noDebt ? "∞" : "—";
  const hfPct       = hf !== null ? Math.min((hf / 3) * 100, 100) : noDebt ? 100 : 0;
  const hfColor     = hf === null
    ? noDebt ? "text-green-700 dark:text-green-400" : "text-gray-400 dark:text-slate-500"
    : hf >= 2 ? "text-green-700 dark:text-green-400"
    : hf >= 1.5 ? "text-yellow-600 dark:text-yellow-400"
    : "text-red-600 dark:text-red-400";
  const barColor    = hf === null
    ? noDebt ? "bg-green-600" : "bg-gray-300 dark:bg-slate-600"
    : hf >= 2 ? "bg-green-600" : hf >= 1.5 ? "bg-yellow-500" : "bg-red-500";

  const hasPosition = position && (position.totalCollateralUSD > 0 || position.totalDebtUSD > 0);

  return (
    <div className="glass-card rounded-2xl border border-gray-200 dark:border-slate-700 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🏛</span>
        <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Your Aave position</h2>
        {isLoading && (
          <span className="ml-auto text-xs bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 px-2 py-0.5 rounded-full">loading…</span>
        )}
        {!isLoading && position && !hasPosition && (
          <span className="ml-auto text-xs bg-gray-100 dark:bg-slate-800 text-gray-500 dark:text-slate-400 px-2 py-0.5 rounded-full">no position</span>
        )}
      </div>

      {hf !== null && hf < 1.5 && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800">
          <span className="text-base">⚠️</span>
          <div>
            <p className="text-xs font-semibold text-red-700 dark:text-red-400">Liquidation risk — HF {hf.toFixed(2)}</p>
            <p className="text-xs text-red-500 dark:text-red-500">Agent auto-runs every 60s to supply collateral.</p>
          </div>
        </div>
      )}
      {hf !== null && hf >= 1.5 && hf < 1.8 && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800">
          <span className="text-base">⚡</span>
          <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">Health factor low — agent auto-runs to add collateral</p>
        </div>
      )}

      <div className="space-y-0 divide-y divide-gray-100 dark:divide-slate-700">
        <PositionRow
          label="Total collateral"
          value={collateral !== null ? `$${collateral.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—"}
          sub="supplied"
          valueClass="text-gray-900 dark:text-slate-100"
        />
        <PositionRow
          label="Debt"
          value={debt !== null ? `$${debt.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—"}
          sub="borrowed"
          valueClass="text-red-600 dark:text-red-400"
        />
        <PositionRow
          label="Available to borrow"
          value={position?.availableBorrowsUSD != null ? `$${position.availableBorrowsUSD.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : "—"}
          sub="liquidity"
          valueClass="text-green-700 dark:text-green-400"
        />
        <div className="py-4 flex items-center justify-between">
          <span className="text-sm text-gray-600 dark:text-slate-400">Health factor</span>
          <div className="flex items-center gap-3">
            <div className="w-32 h-2 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${hfPct}%` }} />
            </div>
            <span className={`text-sm font-semibold w-10 text-right ${hfColor}`}>
              {hfDisplay}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-gray-400 dark:text-slate-500">
        Your wallet · Base Sepolia · Aave V3 · updates every 15s
      </p>
    </div>
  );
}

function PositionRow({ label, value, sub, valueClass }) {
  return (
    <div className="py-4 flex items-center justify-between">
      <span className="text-sm text-gray-600 dark:text-slate-400">{label}</span>
      <div className="text-right">
        <p className={`text-sm font-semibold ${valueClass}`}>{value}</p>
        <p className="text-xs text-gray-400 dark:text-slate-500">{sub}</p>
      </div>
    </div>
  );
}
