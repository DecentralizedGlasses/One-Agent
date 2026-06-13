import { useState } from "react";
import { useReadContract, useWriteContract } from "wagmi";
import { VAULT_ADDRESS, VAULT_ABI } from "../wagmi";

export default function PolicyPanel() {
  const { data: policy, refetch } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "getPolicy",
  });

  const { writeContract, isPending } = useWriteContract();

  const [maxTx,    setMaxTx]    = useState("");
  const [cooldown, setCooldown] = useState("");
  const [hfFloor,  setHfFloor]  = useState("");

  function savePolicy() {
    writeContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "setPolicy",
      args: [
        BigInt(Math.floor(Number(maxTx)    * 1e6)),
        BigInt(Number(cooldown) * 60),
        BigInt(Math.floor(Number(hfFloor)  * 1e18)),
      ],
    }, { onSuccess: () => refetch() });
  }

  const currentMax    = policy ? (Number(policy[2]) / 1e6).toFixed(0)  : "500";
  const currentCd     = policy ? (Number(policy[3]) / 60).toFixed(0)   : "30";
  const currentHf     = policy ? (Number(policy[4]) / 1e18).toFixed(2) : "1.50";
  const isRevoked     = policy?.[1] ?? false;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-5 space-y-4 border border-gray-200 dark:border-slate-700 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Policy Rules</h2>
        {isRevoked && (
          <span className="text-xs bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200 px-2 py-1 rounded">AGENT REVOKED</span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Field
          label={`Max Tx Amount (USDC) — current: ${currentMax}`}
          value={maxTx}
          onChange={setMaxTx}
          placeholder={currentMax}
        />
        <Field
          label={`Cooldown (minutes) — current: ${currentCd}`}
          value={cooldown}
          onChange={setCooldown}
          placeholder={currentCd}
        />
        <Field
          label={`Health Factor Floor — current: ${currentHf}`}
          value={hfFloor}
          onChange={setHfFloor}
          placeholder={currentHf}
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
        disabled={isPending || (!maxTx && !cooldown && !hfFloor)}
        className="px-4 py-2 bg-brand rounded-lg text-sm font-semibold hover:bg-indigo-500 disabled:opacity-40 transition text-white"
      >
        {isPending ? "Saving…" : "Save Policy"}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div className="space-y-1">
      <label className="text-xs text-gray-400 dark:text-slate-500">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-gray-50 dark:bg-slate-900 rounded px-3 py-2 text-sm text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 border border-gray-300 dark:border-slate-700 focus:outline-none focus:border-brand"
      />
    </div>
  );
}
