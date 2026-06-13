import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import PositionCard from "./components/PositionCard";
import PolicyPanel from "./components/PolicyPanel";
import ActionFeed  from "./components/ActionFeed";
import KillSwitch  from "./components/KillSwitch";

export default function App() {
  const { address, isConnected } = useAccount();
  const { connect }    = useConnect();
  const { disconnect } = useDisconnect();

  if (!isConnected) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-brand">AgentGuard</h1>
          <p className="text-gray-400">On-chain policy firewall for AI DeFi agents</p>
          <button
            onClick={() => connect({ connector: injected() })}
            className="px-6 py-3 bg-brand rounded-lg font-semibold hover:bg-indigo-500 transition"
          >
            Connect Wallet
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-brand">AgentGuard</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">{address?.slice(0, 6)}…{address?.slice(-4)}</span>
          <button
            onClick={() => disconnect()}
            className="text-sm text-gray-500 hover:text-gray-300"
          >
            Disconnect
          </button>
        </div>
      </div>

      {/* Top row: position + kill switch */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <PositionCard />
        </div>
        <KillSwitch />
      </div>

      {/* Policy panel */}
      <PolicyPanel />

      {/* Action feed */}
      <ActionFeed />
    </div>
  );
}
