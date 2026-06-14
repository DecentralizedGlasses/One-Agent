import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { VAULT_ADDRESS, VAULT_ABI, VAULT_CHAIN_ID } from "../wagmi";

export default function KillSwitch({ optimisticRevoked, setOptimisticRevoked, refetchPolicy }) {
  const { isConnected } = useAccount();

  const { data: policy, isLoading } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "getPolicy",
    chainId: VAULT_CHAIN_ID,
  });

  const { writeContract, isPending, data: txHash } = useWriteContract();

  useWaitForTransactionReceipt({
    hash: txHash,
    chainId: VAULT_CHAIN_ID,
    query: {
      enabled: !!txHash,
      onSuccess: () => {
        refetchPolicy();
        setOptimisticRevoked(null);
      },
    },
  });

  const onChainRevoked = policy?.[1] ?? false;
  const isRevoked      = optimisticRevoked !== null ? optimisticRevoked : onChainRevoked;
  const agent          = policy?.[0];
  const allowedTargets = policy?.[6] ?? [];

  function revoke() {
    setOptimisticRevoked(true);
    writeContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      chainId: VAULT_CHAIN_ID,
      functionName: "emergencyRevoke",
      args: [],
    }, { onError: () => setOptimisticRevoked(null) });
  }

  function reinstate() {
    setOptimisticRevoked(false);
    writeContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      chainId: VAULT_CHAIN_ID,
      functionName: "reinstateAgent",
      args: [],
    }, { onError: () => setOptimisticRevoked(null) });
  }

  if (isRevoked) {
    return (
      <div className="bg-red-50 dark:bg-red-950 rounded-xl p-5 flex flex-col gap-4 border border-red-300 dark:border-red-700 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <p className="text-sm font-bold text-red-700 dark:text-red-300 uppercase tracking-wider">Agent Revoked</p>
        </div>

        <p className="text-xs text-red-600 dark:text-red-400">
          The AI agent has lost access to the vault and all whitelisted contracts. No transactions can go through.
        </p>

        {agent && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-red-700 dark:text-red-300">Blocked agent</p>
            <p className="text-xs font-mono bg-red-100 dark:bg-red-900 rounded px-2 py-1 text-red-800 dark:text-red-200">
              {agent.slice(0, 6)}…{agent.slice(-4)}
            </p>
          </div>
        )}

        {allowedTargets.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-red-700 dark:text-red-300">Contracts now blocked</p>
            <div className="flex flex-wrap gap-1">
              {allowedTargets.map(addr => (
                <span key={addr} className="text-xs font-mono bg-red-100 dark:bg-red-900 rounded px-2 py-1 text-red-800 dark:text-red-200">
                  {addr.slice(0, 6)}…{addr.slice(-4)}
                </span>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={reinstate}
          disabled={isPending || !isConnected}
          className="w-full py-3 rounded-lg font-bold text-sm bg-green-600 hover:bg-green-500 text-white transition disabled:opacity-40"
        >
          {isPending ? "Confirm in MetaMask…" : "Reinstate Agent"}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-5 flex flex-col items-center justify-center gap-4 border border-gray-200 dark:border-slate-700 shadow-sm">
      <p className="text-sm text-gray-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Kill Switch</p>
      <div className={`w-4 h-4 rounded-full ${isLoading ? "bg-yellow-400 animate-pulse" : "bg-green-500 animate-pulse"}`} />
      <p className="text-xs font-semibold uppercase text-gray-500 dark:text-slate-300">
        {isLoading ? "Checking vault…" : "Agent active"}
      </p>
      <button
        onClick={revoke}
        disabled={isPending || !isConnected}
        className="w-full py-3 rounded-lg font-bold text-sm bg-red-600 hover:bg-red-500 text-white transition disabled:opacity-40"
      >
        {isPending ? "Confirm in MetaMask…" : "Emergency Revoke"}
      </button>
    </div>
  );
}
