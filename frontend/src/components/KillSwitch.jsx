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
    <div className="bg-white dark:bg-slate-900 rounded-xl p-5 flex flex-col items-center justify-center gap-4 border border-gray-200 dark:border-slate-700 shadow-sm">
      <p className="text-sm text-gray-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Kill Switch</p>

      <div className={`w-4 h-4 rounded-full ${isRevoked ? "bg-red-500" : "bg-green-500"} animate-pulse`} />

      <p className="text-xs text-gray-400 dark:text-slate-500">{isRevoked ? "Agent is REVOKED" : "Agent is ACTIVE"}</p>

      <button
        onClick={toggle}
        disabled={isPending}
        className={`w-full py-3 rounded-lg font-bold text-sm transition disabled:opacity-40 ${
          isRevoked
            ? "bg-green-600 hover:bg-green-500 text-white"
            : "bg-red-600 hover:bg-red-500 text-white"
        }`}
      >
        {isPending
          ? "Confirming…"
          : isRevoked
          ? "Reinstate Agent"
          : "Emergency Revoke"}
      </button>
    </div>
  );
}
