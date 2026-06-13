import { useReadContract, useWriteContract } from "wagmi";
import { VAULT_ADDRESS, VAULT_ABI } from "../wagmi";

export default function KillSwitch() {
  const { data: policy, refetch } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "getPolicy",
  });

  const { writeContract, isPending } = useWriteContract();

  const isRevoked = policy?.[1] ?? false;

  function toggle() {
    writeContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: isRevoked ? "reinstateAgent" : "emergencyRevoke",
      args: [],
    }, { onSuccess: () => refetch() });
  }

  return (
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm uppercase tracking-[0.22em] text-slate-500">Kill switch</p>
      <div className="mt-4 rounded-3xl bg-slate-50 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className={`inline-flex h-3.5 w-3.5 rounded-full ${isRevoked ? "bg-rose-500" : "bg-emerald-500"}`} />
          <p className="text-sm font-semibold text-slate-900">{isRevoked ? "Agent revoked" : "Agent active"}</p>
        </div>
      </div>

      <p className="mt-4 text-sm text-slate-500">Protect the agent by toggling emergency revoke state.</p>

      <button
        onClick={toggle}
        disabled={isPending}
        className={`mt-6 w-full rounded-full px-4 py-3 text-sm font-semibold text-white transition ${
          isRevoked
            ? "bg-emerald-600 hover:bg-emerald-500"
            : "bg-rose-600 hover:bg-rose-500"
        } disabled:cursor-not-allowed disabled:opacity-60`}
      >
        {isPending ? "Confirming…" : isRevoked ? "Reinstate agent" : "Emergency revoke"}
      </button>
    </div>
  );
}
