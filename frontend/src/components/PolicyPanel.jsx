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

  const [maxTx, setMaxTx] = useState("");
  const [cooldown, setCooldown] = useState("");
  const [hfFloor, setHfFloor] = useState("");

  function savePolicy() {
    writeContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "setPolicy",
      args: [
        BigInt(Math.floor(Number(maxTx) * 1e6)),
        BigInt(Number(cooldown) * 60),
        BigInt(Math.floor(Number(hfFloor) * 1e18)),
      ],
    }, { onSuccess: () => refetch() });
  }

  const currentMax = policy ? (Number(policy[2]) / 1e6).toFixed(0) : "500";
  const currentCd = policy ? (Number(policy[3]) / 60).toFixed(0) : "30";
  const currentHf = policy ? (Number(policy[4]) / 1e18).toFixed(2) : "1.50";
  const isRevoked = policy?.[1] ?? false;

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Policy rules</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-950">Guardrails</h3>
        </div>
        {isRevoked && (
          <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">Agent revoked</span>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Field
          label={`Max tx amount (USDC)`}
          value={maxTx}
          onChange={setMaxTx}
          placeholder={currentMax}
        />
        <Field
          label={`Cooldown (minutes)`}
          value={cooldown}
          onChange={setCooldown}
          placeholder={currentCd}
        />
        <Field
          label={`Health factor floor`}
          value={hfFloor}
          onChange={setHfFloor}
          placeholder={currentHf}
        />
      </div>

      <div className="mt-5 rounded-3xl bg-slate-50 p-4 text-sm text-slate-500">
        Protocol whitelist is visible in the vault contract and is read-only in this view.
      </div>

      <button
        onClick={savePolicy}
        disabled={isPending || (!maxTx && !cooldown && !hfFloor)}
        className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Save policy"}
      </button>
    </div>
  );
}

function Field({ label, value, onChange, placeholder }) {
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</label>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
      />
    </div>
  );
}
