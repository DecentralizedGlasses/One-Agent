import { useMemo, useState } from "react";
import { useDynamicContext, DynamicWidget } from "@dynamic-labs/sdk-react-core";
import { useConnectedWallet } from "../hooks/useConnectedWallet";

export default function WalletStatus() {
  const { primaryWallet } = useDynamicContext();
  const { address, connectorName, isConnected } = useConnectedWallet();
  const [error, setError] = useState("");

  const shortenedAddress = useMemo(() => {
    if (!address) return null;
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }, [address]);

  async function handleKillSwitch() {
    setError("");
    if (!primaryWallet) {
      setError("Connect a wallet before using the kill switch.");
      return;
    }

    try {
      const walletClient = await primaryWallet.connector?.getWalletClient();
      console.log("Kill switch wallet client:", walletClient);
      // TODO: call PolicyVault.emergencyRevoke() here.
    } catch (err) {
      console.error(err);
      setError("Unable to access connected wallet client.");
    }
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-5 space-y-4 border border-gray-200 dark:border-slate-700 shadow-sm">
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Wallet Protection</h2>
            <p className="text-xs text-gray-400 dark:text-slate-500">This is the wallet One-Agent is protecting.</p>
          </div>
          <DynamicWidget
            buttonClassName="px-3 py-2 rounded-lg bg-brand text-white text-sm hover:bg-indigo-500"
            buttonContainerClassName=""
          />
        </div>

        {isConnected ? (
          <div className="space-y-2 text-sm text-slate-900 dark:text-slate-100">
            <p className="font-semibold">Connected wallet</p>
            <p className="text-sm text-gray-600 dark:text-slate-300">{shortenedAddress}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400">{connectorName}</p>
          </div>
        ) : (
          <p className="text-sm text-gray-600 dark:text-slate-300">Connect a wallet to activate One-Agent protection.</p>
        )}

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <button
          onClick={handleKillSwitch}
          className="w-full inline-flex justify-center items-center px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-500 transition disabled:opacity-40"
        >
          Kill Switch
        </button>
      </div>
    </div>
  );
}
