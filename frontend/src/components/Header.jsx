import { useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useWriteContract, useWaitForTransactionReceipt, useEnsName } from "wagmi";
import { mainnet, sepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";
import { VAULT_ADDRESS, VAULT_ABI, VAULT_CHAIN_ID } from "../wagmi";

export default function Header({ agentRevoked, setOptimisticRevoked, refetchPolicy }) {
  const { address, isConnected } = useAccount();
  const { data: ensNameMainnet } = useEnsName({ address, chainId: mainnet.id });
  const { data: ensNameSepolia } = useEnsName({ address, chainId: sepolia.id });
  const ensName = ensNameMainnet ?? ensNameSepolia ?? import.meta.env.VITE_MOCK_ENS ?? null;
  const { connect }    = useConnect();
  const { disconnect } = useDisconnect();

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

  function toggleKillSwitch() {
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
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="max-w-5xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
          </div>
          <span className="text-xl font-bold text-gray-900">One-Agent</span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          {isConnected ? (
            <>
              {/* Agent status */}
              <div className="flex items-center gap-1.5">
                <div className={`w-2 h-2 rounded-full ${agentRevoked ? "bg-red-500" : "bg-green-500"}`} />
                <span className="text-sm text-gray-600">{agentRevoked ? "Agent stopped" : "Agent active"}</span>
              </div>

              {/* Wallet address / ENS name */}
              <button
                onClick={() => disconnect()}
                className="text-sm bg-gray-100 hover:bg-gray-200 rounded-lg px-3 py-1.5 text-gray-700 font-mono transition"
              >
                {ensName ?? `${address?.slice(0, 6)}…${address?.slice(-4)}`}
              </button>

              {/* Kill Switch */}
              <button
                onClick={toggleKillSwitch}
                disabled={isPending || !isConnected}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition disabled:opacity-50 ${
                  agentRevoked
                    ? "bg-green-600 hover:bg-green-500 text-white border-green-600"
                    : "bg-white hover:bg-gray-50 text-gray-900 border-gray-300"
                }`}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="3" width="18" height="18" rx="2" />
                </svg>
                {isPending ? "Confirming…" : agentRevoked ? "Reinstate" : "Kill switch"}
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
