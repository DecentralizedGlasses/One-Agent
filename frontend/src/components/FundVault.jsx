import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract, useChainId, useSwitchChain } from "wagmi";
import { parseAbi, parseUnits, formatUnits } from "viem";
import { baseSepolia } from "wagmi/chains";
import { VAULT_ADDRESS, USDC_ADDRESS, VAULT_CHAIN_ID } from "../wagmi";

const ERC20_ABI = parseAbi([
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
]);

const AGENT_URL = import.meta.env.VITE_AGENT_URL || "http://localhost:3001";

export default function FundVault() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();

  const [amount,     setAmount]     = useState("");
  const [copied,     setCopied]     = useState(false);
  const [vaultInfo,  setVaultInfo]  = useState(null);

  // User's USDC balance
  const { data: userBalance, refetch: refetchUserBal } = useReadContract({
    address: USDC_ADDRESS, abi: ERC20_ABI,
    functionName: "balanceOf", args: [address],
    chainId: VAULT_CHAIN_ID,
    query: { enabled: isConnected && !!address, refetchInterval: 15000 },
  });

  const { writeContract, isPending, data: txHash, reset } = useWriteContract();

  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash, chainId: VAULT_CHAIN_ID,
    query: { enabled: !!txHash },
  });

  useEffect(() => {
    if (isSuccess) {
      setAmount("");
      refetchUserBal();
      fetchVaultInfo();
      reset();
    }
  }, [isSuccess]);

  async function fetchVaultInfo() {
    const res = await fetch(`${AGENT_URL}/vault-info`).catch(() => null);
    if (res?.ok) {
      const d = await res.json();
      if (!d.error) setVaultInfo(d);
    }
  }

  useEffect(() => {
    fetchVaultInfo();
    const id = setInterval(fetchVaultInfo, 15000);
    return () => clearInterval(id);
  }, []);

  async function send() {
    if (!amount || Number(amount) <= 0) return;
    if (chainId !== VAULT_CHAIN_ID) {
      try { await switchChainAsync({ chainId: VAULT_CHAIN_ID }); }
      catch { return; }
    }
    writeContract({
      address: USDC_ADDRESS, abi: ERC20_ABI,
      chainId: VAULT_CHAIN_ID,
      functionName: "transfer",
      args: [VAULT_ADDRESS, parseUnits(amount, 6)],
    });
  }

  function copyAddress() {
    navigator.clipboard.writeText(VAULT_ADDRESS ?? "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const userBalanceUsdc = userBalance != null ? Number(formatUnits(userBalance, 6)) : null;
  const vaultUsdc  = vaultInfo?.usdcBalance  ?? null;
  const vaultAusdc = vaultInfo?.ausdcBalance ?? null;

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 p-5">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">💰</span>
        <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Fund vault</h2>
      </div>

      {/* Vault balances */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-gray-50 dark:bg-slate-800 rounded-xl px-3 py-2.5 border border-gray-200 dark:border-slate-700">
          <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-1">Vault USDC (idle)</p>
          <p className="text-sm font-bold text-gray-900 dark:text-slate-100">
            {vaultUsdc != null ? `${vaultUsdc.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC` : "—"}
          </p>
        </div>
        <div className="bg-gray-50 dark:bg-slate-800 rounded-xl px-3 py-2.5 border border-gray-200 dark:border-slate-700">
          <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wide mb-1">Vault aUSDC (in Aave)</p>
          <p className="text-sm font-bold text-gray-900 dark:text-slate-100">
            {vaultAusdc != null ? `${vaultAusdc.toLocaleString("en-US", { maximumFractionDigits: 2 })} aUSDC` : "—"}
          </p>
        </div>
      </div>

      {/* Vault address */}
      <div className="mb-4">
        <p className="text-xs text-gray-400 dark:text-slate-500 mb-1.5">Vault address (Base Sepolia)</p>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
          <span className="flex-1 font-mono text-xs text-gray-700 dark:text-slate-300 break-all">{VAULT_ADDRESS}</span>
          <button
            onClick={copyAddress}
            className="flex-shrink-0 text-xs px-2 py-1 rounded-lg bg-gray-200 dark:bg-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-300 dark:hover:bg-slate-600 font-medium transition"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>

      {/* Success banner */}
      {isSuccess && (
        <div className="mb-4 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-xs text-green-800 dark:text-green-300 font-medium">
          ✓ USDC sent to vault successfully.
        </div>
      )}

      {/* Amount input + send */}
      <div className="flex items-center gap-2 mb-2">
        <input
          type="number"
          min="1"
          step="1"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="Amount"
          className="flex-1 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5 text-gray-900 dark:text-slate-100 placeholder-gray-300 dark:placeholder-slate-600 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500"
        />
        <span className="text-xs text-gray-400 dark:text-slate-500 font-medium">USDC</span>
        <button
          onClick={send}
          disabled={isPending || isConfirming || !amount || Number(amount) <= 0}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-40 transition whitespace-nowrap"
        >
          {isPending ? "Confirm…" : isConfirming ? "Sending…" : "Send to vault"}
        </button>
      </div>

      {/* User balance hint */}
      {userBalanceUsdc != null && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400 dark:text-slate-500">
            Your wallet: <span className="font-medium text-gray-600 dark:text-slate-400">{userBalanceUsdc.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC</span>
          </p>
          {userBalanceUsdc > 0 && (
            <button
              onClick={() => setAmount(Math.floor(userBalanceUsdc).toString())}
              className="text-xs text-blue-500 dark:text-blue-400 hover:underline"
            >
              Max
            </button>
          )}
        </div>
      )}
    </div>
  );
}
