import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import { DynamicWidget } from "@dynamic-labs/sdk-react-core";
import { VAULT_ADDRESS, VAULT_ABI, VAULT_CHAIN_ID } from "./wagmi";
import Header       from "./components/Header";
import StatsRow     from "./components/StatsRow";
import PositionCard from "./components/PositionCard";
import PolicyPanel  from "./components/PolicyPanel";
import ActionFeed   from "./components/ActionFeed";

export default function App() {
  const [optimisticRevoked, setOptimisticRevoked] = useState(null);
  const [position, setPosition] = useState(null);
  const [log,      setLog]      = useState([]);

  const { isConnected } = useAccount();

  const { data: policy, refetch: refetchPolicy } = useReadContract({
    address: VAULT_ADDRESS, abi: VAULT_ABI,
    functionName: "getPolicy", chainId: VAULT_CHAIN_ID,
    query: { enabled: isConnected },
  });

  const onChainRevoked = policy?.[1] ?? false;
  const agentRevoked   = optimisticRevoked !== null ? optimisticRevoked : onChainRevoked;

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-cream flex items-center justify-center px-4">
        <div className="text-center space-y-5">
          <div className="flex items-center justify-center gap-2">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-gray-900">One-Agent</span>
          </div>
          <p className="text-gray-500 text-sm">On-chain policy firewall for AI DeFi agents</p>
          <DynamicWidget />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream">
      <Header
        agentRevoked={agentRevoked}
        setOptimisticRevoked={setOptimisticRevoked}
        refetchPolicy={refetchPolicy}
      />

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        <StatsRow position={position} log={log} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
          <div className="space-y-4">
            <PositionCard onPosition={setPosition} />
            <PolicyPanel />
          </div>
          <ActionFeed agentRevoked={agentRevoked} onLog={setLog} />
        </div>
      </main>
    </div>
  );
}
