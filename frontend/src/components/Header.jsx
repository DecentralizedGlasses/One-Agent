import { useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt, useEnsName, useChainId, useSwitchChain } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { VAULT_ADDRESS, VAULT_ABI, VAULT_CHAIN_ID } from "../wagmi";

export default function Header({ agentRevoked, setOptimisticRevoked, refetchPolicy, isDark, toggleDark }) {
  const { address, isConnected } = useAccount();
  const { connect }    = useConnect();
  const { disconnect } = useDisconnect();

  const { data: ensNameMainnet } = useEnsName({ address, chainId: mainnet.id });
  const { data: ensNameSepolia } = useEnsName({ address, chainId: sepolia.id });
  const ensName = ensNameMainnet ?? ensNameSepolia ?? import.meta.env.VITE_MOCK_ENS ?? null;

  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContract, isPending, data: txHash } = useWriteContract();

  const { isSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
    chainId: VAULT_CHAIN_ID,
    query: { enabled: !!txHash },
  });

  useEffect(() => {
    if (isSuccess) {
      refetchPolicy();
      setOptimisticRevoked(null);
    }
  }, [isSuccess]);

  async function toggleKillSwitch() {
    if (chainId !== VAULT_CHAIN_ID) {
      try { await switchChainAsync({ chainId: VAULT_CHAIN_ID }); }
      catch { return; }
    }
    if (agentRevoked) {
      setOptimisticRevoked(false);
      writeContract({
        address: VAULT_ADDRESS, abi: VAULT_ABI, chainId: VAULT_CHAIN_ID,
        functionName: "reinstateAgent", args: [],
      }, { onError: () => setOptimisticRevoked(null) });
    } else {
      setOptimisticRevoked(true);
      writeContract({
        address: VAULT_ADDRESS, abi: VAULT_ABI, chainId: VAULT_CHAIN_ID,
        functionName: "emergencyRevoke", args: [],
      }, { onError: () => setOptimisticRevoked(null) });
    }
  }

  return (
    <header className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 px-6 py-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <span className="text-xl font-bold text-gray-900 dark:text-slate-100">One-Agent</span>
        </div>

        <div className="flex items-center gap-3">
          {isConnected ? (
            <>
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${agentRevoked ? "bg-red-500" : "bg-green-500"}`} />
                <span className="text-sm text-gray-600 dark:text-slate-400">{agentRevoked ? "Agent stopped" : "Agent active"}</span>
              </div>

              <button
                onClick={() => disconnect()}
                className="text-sm bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg px-3 py-1.5 text-gray-700 dark:text-slate-300 font-mono transition"
              >
                {ensName ?? `${address?.slice(0, 6)}…${address?.slice(-4)}`}
              </button>

              <button
                onClick={toggleKillSwitch}
                disabled={isPending}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition disabled:opacity-50 ${
                  agentRevoked
                    ? "bg-green-600 hover:bg-green-500 text-white border-green-600"
                    : "bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-900 dark:text-slate-100 border-gray-300 dark:border-slate-600"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
                {isPending ? "Confirming…" : agentRevoked ? "Reinstate" : "Kill switch"}
              </button>

              {/* Dark / light mode toggle */}
              <button
                onClick={toggleDark}
                title={isDark ? "Switch to light mode" : "Switch to dark mode"}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700 transition"
              >
                {isDark ? (
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="4" />
                    <line x1="12" y1="2"  x2="12" y2="5"  />
                    <line x1="12" y1="19" x2="12" y2="22" />
                    <line x1="4.22"  y1="4.22"  x2="6.34"  y2="6.34"  />
                    <line x1="17.66" y1="17.66" x2="19.78" y2="19.78" />
                    <line x1="2"  y1="12" x2="5"  y2="12" />
                    <line x1="19" y1="12" x2="22" y2="12" />
                    <line x1="4.22"  y1="19.78" x2="6.34"  y2="17.66" />
                    <line x1="17.66" y1="6.34"  x2="19.78" y2="4.22"  />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                  </svg>
                )}
              </button>
            </>
          ) : (
            <button
              onClick={() => connect({ connector: injected() })}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-500 transition"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
