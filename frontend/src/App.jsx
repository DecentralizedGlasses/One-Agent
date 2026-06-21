import { useState } from "react";
import { useAccount, useConnect, useReadContract } from "wagmi";
import { injected } from "wagmi/connectors";
import { VAULT_ADDRESS, VAULT_ABI, VAULT_CHAIN_ID } from "./wagmi";
import Header          from "./components/Header";
import StatsRow        from "./components/StatsRow";
import PositionCard    from "./components/PositionCard";
import PolicyPanel     from "./components/PolicyPanel";
import ActionFeed      from "./components/ActionFeed";
import EthPriceTarget  from "./components/EthPriceTarget";
import FundVault       from "./components/FundVault";
import LivePrices      from "./components/LivePrices";
import useDarkMode     from "./hooks/useDarkMode";

/* ── Shared background layer (fixed, behind everything) ─────────────────── */
function Background() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-grid">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-indigo-50/60 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950" />

      {/* Blob 1 — top-left, blue */}
      <div className="animate-blob absolute -top-56 -left-56 h-[680px] w-[680px] rounded-full
                      bg-blue-300/30 dark:bg-blue-700/20 blur-[130px]" />

      {/* Blob 2 — top-right, violet */}
      <div className="animate-blob animation-delay-3
                      absolute -top-32 right-0 h-[520px] w-[520px] rounded-full
                      bg-violet-300/25 dark:bg-violet-700/15 blur-[110px]" />

      {/* Blob 3 — bottom-center, indigo */}
      <div className="animate-blob animation-delay-6
                      absolute bottom-0 left-1/2 h-[480px] w-[700px] -translate-x-1/2 rounded-full
                      bg-indigo-300/20 dark:bg-indigo-700/12 blur-[130px]" />

      {/* Blob 4 — bottom-right, cyan */}
      <div className="animate-blob animation-delay-9
                      absolute -bottom-40 right-0 h-[400px] w-[400px] rounded-full
                      bg-cyan-300/20 dark:bg-cyan-600/12 blur-[100px]" />
    </div>
  );
}

export default function App() {
  const [optimisticRevoked, setOptimisticRevoked] = useState(null);
  const [position, setPosition] = useState(null);
  const [log,      setLog]      = useState([]);
  const [isDark,   toggleDark]  = useDarkMode();

  const { isConnected } = useAccount();
  const { connect }     = useConnect();

  const { data: policy, refetch: refetchPolicy } = useReadContract({
    address: VAULT_ADDRESS, abi: VAULT_ABI,
    functionName: "getPolicy", chainId: VAULT_CHAIN_ID,
    query: { enabled: isConnected },
  });

  const onChainRevoked = policy?.[1] ?? false;
  const agentRevoked   = optimisticRevoked !== null ? optimisticRevoked : onChainRevoked;

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <Background />
        <div className="text-center space-y-5">
          <div className="flex items-center justify-center gap-2">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
              </svg>
            </div>
            <span className="text-2xl font-bold text-gray-900 dark:text-slate-100">One-Agent</span>
          </div>
          <p className="text-gray-500 dark:text-slate-400 text-sm">On-chain policy firewall for AI DeFi agents</p>
          <button
            onClick={() => connect({ connector: injected() })}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white rounded-xl font-semibold shadow-lg shadow-blue-500/25 transition"
          >
            Connect Wallet
          </button>
          <button
            onClick={toggleDark}
            className="block mx-auto text-xs text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 transition"
          >
            {isDark ? "Switch to light mode" : "Switch to dark mode"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <Background />
      <Header
        agentRevoked={agentRevoked}
        setOptimisticRevoked={setOptimisticRevoked}
        refetchPolicy={refetchPolicy}
        isDark={isDark}
        toggleDark={toggleDark}
      />

      <main className="max-w-screen-xl mx-auto px-4 py-6 space-y-4">
        <StatsRow position={position} log={log} />

        {/* 3-col layout: live prices (1/3) | panels + feed (2/3) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

          {/* Left 1/3 — live price ticker */}
          <div className="lg:col-span-1">
            <LivePrices />
          </div>

          {/* Right 2/3 — agent panels + action feed */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div className="space-y-4">
              <PositionCard onPosition={setPosition} />
              <PolicyPanel />
              <FundVault />
              <EthPriceTarget />
            </div>
            <ActionFeed agentRevoked={agentRevoked} onLog={setLog} />
          </div>

        </div>
      </main>
    </div>
  );
}
