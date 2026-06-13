import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { injected } from "wagmi/connectors";
import { DynamicWidget } from "@dynamic-labs/sdk-react-core";
import PositionCard from "./components/PositionCard";
import PolicyPanel  from "./components/PolicyPanel";
import ActionFeed   from "./components/ActionFeed";
import KillSwitch   from "./components/KillSwitch";
import WalletStatus from "./components/WalletStatus";

export default function App() {
  const [theme, setTheme] = useState("light");
  const { address, isConnected } = useAccount();
  const { connect }    = useConnect();
  const { disconnect } = useDisconnect();

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const nextTheme = savedTheme ?? (prefersDark ? "dark" : "light");
    setTheme(nextTheme);
    document.documentElement.classList.remove("dark");
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("theme", theme);
    document.documentElement.classList.remove("dark");
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => {
      const next = current === "dark" ? "light" : "dark";
      document.documentElement.classList.remove("dark");
      if (next === "dark") {
        document.documentElement.classList.add("dark");
      }
      return next;
    });
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <h1 className="text-3xl font-bold text-brand">One-Agent</h1>
          <p className="text-gray-500 dark:text-slate-300">On-chain policy firewall for AI DeFi agents</p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <DynamicWidget
              buttonClassName="px-6 py-3 bg-brand text-white rounded-lg font-semibold hover:bg-indigo-500 transition"
              buttonContainerClassName=""
            />
            <button
              onClick={() => connect({ connector: injected() })}
              className="px-6 py-3 bg-slate-900 text-white rounded-lg font-semibold hover:bg-slate-800 transition"
            >
              Connect Wallet
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-brand">One-Agent</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">On-chain policy firewall for AI DeFi agents</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={toggleTheme}
            className="px-3 py-2 rounded-lg border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-100 transition dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
          >
            {theme === "dark" ? "☀" : "☾"}
          </button>
          <span className="text-sm text-gray-500 dark:text-slate-300">{address?.slice(0, 6)}…{address?.slice(-4)}</span>
          <button
            onClick={() => disconnect()}
            className="text-sm text-gray-400 hover:text-gray-600 dark:text-slate-300 dark:hover:text-slate-100"
          >
            Disconnect
          </button>
        </div>
      </div>

      <WalletStatus />

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
