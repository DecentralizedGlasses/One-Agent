import { useState } from "react";
import { useReadContract, useWriteContract } from "wagmi";
import { VAULT_ADDRESS, VAULT_ABI } from "../wagmi";
import { useResolvedAddress } from "../hooks/useResolvedAddress";

export default function PolicyPanel() {
  const { resolvedAddress: vaultAddress } = useResolvedAddress(VAULT_ADDRESS);
  const { data: policy, refetch } = useReadContract({
    address: vaultAddress,
    abi: VAULT_ABI,
    functionName: "getPolicy",
    query: { enabled: Boolean(vaultAddress) },
  });

  const { writeContract, isPending } = useWriteContract();

  const [maxTx,      setMaxTx]      = useState("");
  const [cooldown,   setCooldown]   = useState("");
  const [hfFloor,    setHfFloor]    = useState("");
  const [priceFloor, setPriceFloor] = useState("");

  const currentMax   = policy ? (Number(policy[2]) / 1e6).toFixed(0)  : "500";
  const currentCd    = policy ? (Number(policy[3]) / 60).toFixed(0)   : "30";
  const currentHf    = policy ? (Number(policy[4]) / 1e18).toFixed(2) : "1.50";
  const currentPrice = policy ? (Number(policy[5]) / 1e8).toFixed(0)  : "1500";
  const isRevoked    = policy?.[1] ?? false;

  function savePolicy() {
    if (!vaultAddress) return;

    writeContract({
      address: vaultAddress,
      abi: VAULT_ABI,
      functionName: "setPolicy",
      args: [
        BigInt(Math.floor(Number(maxTx)      * 1e6)),
        BigInt(Number(cooldown)              * 60),
        BigInt(Math.floor(Number(hfFloor)    * 1e18)),
        BigInt(Math.floor(Number(priceFloor) * 1e8)),
      ],
    }, {
      onSuccess: () => {
        refetch();
        setMaxTx(""); setCooldown(""); setHfFloor(""); setPriceFloor("");
      }
    });
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-5 space-y-4 border border-gray-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Policy Rules</h2>
        {isRevoked && (
          <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 px-2 py-1 rounded">AGENT REVOKED</span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Field
          label="Max Tx Amount (USDC)"
          current={currentMax}
          value={maxTx}
          onChange={setMaxTx}
          placeholder={currentMax}
          step="1"
        />
        <Field
          label="Cooldown (minutes)"
          current={currentCd}
          value={cooldown}
          onChange={setCooldown}
          placeholder={currentCd}
          integersOnly
        />
        <Field
          label="Health Factor Floor"
          current={currentHf}
          value={hfFloor}
          onChange={setHfFloor}
          placeholder={currentHf}
          step="0.01"
        />
        <Field
          label="ETH Price Floor (USD)"
          current={`$${currentPrice}`}
          value={priceFloor}
          onChange={setPriceFloor}
          placeholder={currentPrice}
          step="1"
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs text-gray-400 dark:text-slate-500">Protocol Whitelist</p>
        <div className="flex gap-2 flex-wrap">
          {policy?.[6]?.map((addr) => (
            <span key={addr} className="text-xs bg-gray-100 dark:bg-slate-800 rounded px-2 py-1 text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700">
              {addr.slice(0, 6)}…{addr.slice(-4)}
            </span>
          )) ?? <span className="text-xs text-gray-400 dark:text-slate-500">—</span>}
        </div>
      </div>

      <button
        onClick={savePolicy}
        disabled={isPending || !vaultAddress || !maxTx || !cooldown || !hfFloor || !priceFloor}
        className="px-4 py-2 bg-brand rounded-lg text-sm font-semibold hover:bg-indigo-500 disabled:opacity-40 transition text-white"
      >
        {isPending ? "Saving…" : "Save Policy"}
      </button>
    </div>
  );
}

function Field({ label, current, value, onChange, placeholder, integersOnly = false, step = "1" }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-gray-500 dark:text-slate-400">{label}</label>
      <p className="text-xs text-gray-400 dark:text-slate-500">Current: {current}</p>
      <input
        type="number"
        inputMode={integersOnly ? "numeric" : "decimal"}
        min="0"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (["e","E","+","-"].includes(e.key) || (integersOnly && e.key === ".")) e.preventDefault();
        }}
        placeholder={placeholder}
        className="w-full bg-gray-50 dark:bg-slate-900 rounded px-3 py-2 text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 border border-gray-300 dark:border-slate-700 focus:outline-none focus:border-brand"
      />
    </div>
  );
}
