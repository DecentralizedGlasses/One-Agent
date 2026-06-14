import { useMemo } from "react";
import { useConnectedWallet } from "../hooks/useConnectedWallet";

export default function WalletStatus() {
  const { address, connectorName, isConnected } = useConnectedWallet();

  const shortenedAddress = useMemo(() => {
    if (!address) return null;
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }, [address]);

  if (!isConnected) return null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-4 border border-gray-200 dark:border-slate-700 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-2">Wallet Protection</h2>
      <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">This is the wallet One-Agent is protecting.</p>
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{shortenedAddress}</p>
          <p className="text-xs text-gray-400 dark:text-slate-500">{connectorName}</p>
        </div>
      </div>
    </div>
  );
}
