import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  useAccount, useWriteContract, useWaitForTransactionReceipt,
  useReadContract, useChainId, useSwitchChain,
} from "wagmi";
import { parseAbi, parseUnits, formatUnits, encodeFunctionData } from "viem";
import { VAULT_ADDRESS, USDC_ADDRESS, VAULT_ABI, VAULT_CHAIN_ID } from "../wagmi";

const ERC20_ABI = parseAbi([
  "function balanceOf(address account) external view returns (uint256)",
  "function transfer(address to, uint256 amount) external returns (bool)",
]);

// ── Shared token pill ────────────────────────────────────────────────────────
function TokenBadge({ balance, label }) {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600">
      <div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
        <span className="text-[11px] font-extrabold text-white">$</span>
      </div>
      <div>
        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100 leading-none">USDC</p>
        <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">USD Coin · Base Sepolia</p>
      </div>
      <div className="ml-auto text-right">
        <p className="text-xs text-gray-400 dark:text-slate-500">{label}</p>
        <p className="text-sm font-semibold text-gray-700 dark:text-slate-200">
          {balance != null ? `${balance.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC` : "—"}
        </p>
      </div>
    </div>
  );
}

// ── Modal body ────────────────────────────────────────────────────────────────
function ModalContent({ mode, vaultUsdc, onClose, onSuccess }) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const [amount, setAmount] = useState("");
  const [submitError, setSubmitError] = useState(null);

  // User's wallet USDC balance (Fund mode)
  const { data: userBalanceRaw } = useReadContract({
    address: USDC_ADDRESS, abi: ERC20_ABI,
    functionName: "balanceOf", args: [address],
    chainId: VAULT_CHAIN_ID,
    query: { enabled: mode === "fund" && !!address, refetchInterval: 10000 },
  });
  const userUsdc = userBalanceRaw != null ? Number(formatUnits(userBalanceRaw, 6)) : null;

  const { writeContract, isPending, data: txHash, reset } = useWriteContract();
  const { isSuccess, isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txHash, chainId: VAULT_CHAIN_ID,
    query: { enabled: !!txHash },
  });

  useEffect(() => {
    if (isSuccess) {
      onSuccess?.();
      const t = setTimeout(onClose, 2200);
      return () => clearTimeout(t);
    }
  }, [isSuccess]);

  const maxAmount   = mode === "fund" ? userUsdc : vaultUsdc;
  const isFund      = mode === "fund";
  const accentClass = isFund ? "bg-blue-600 hover:bg-blue-500" : "bg-amber-600 hover:bg-amber-500";

  async function handleSubmit() {
    if (!amount || Number(amount) <= 0) return;
    setSubmitError(null);
    try {
      if (chainId !== VAULT_CHAIN_ID) await switchChainAsync({ chainId: VAULT_CHAIN_ID });

      if (isFund) {
        // User wallet → vault: plain ERC-20 transfer
        writeContract({
          address: USDC_ADDRESS, abi: ERC20_ABI,
          chainId: VAULT_CHAIN_ID,
          functionName: "transfer",
          args: [VAULT_ADDRESS, parseUnits(amount, 6)],
        });
      } else {
        // Vault → user wallet: vault.execute( USDC, 0, transfer(user, amount) )
        // Passes through PolicyVault firewall — whitelist, cooldown, HF checks apply.
        const callData = encodeFunctionData({
          abi: parseAbi(["function transfer(address to, uint256 amount) external returns (bool)"]),
          functionName: "transfer",
          args: [address, parseUnits(amount, 6)],
        });
        writeContract({
          address: VAULT_ADDRESS, abi: VAULT_ABI,
          chainId: VAULT_CHAIN_ID,
          functionName: "execute",
          args: [USDC_ADDRESS, 0n, callData],
        });
      }
    } catch (e) {
      setSubmitError(e?.shortMessage || e?.message || "Transaction rejected");
    }
  }

  const amountNum = Number(amount);
  const overMax   = maxAmount != null && amountNum > maxAmount;
  const disabled  = isPending || isConfirming || !amount || amountNum <= 0 || overMax || isSuccess;

  return (
    <>
      {/* Title bar */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isFund ? "bg-blue-100 dark:bg-blue-900" : "bg-amber-100 dark:bg-amber-900"}`}>
            {isFund
              ? <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
              : <svg className="w-4 h-4 text-amber-600 dark:text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20 12H4"/></svg>
            }
          </div>
          <h2 className="text-base font-bold text-gray-900 dark:text-slate-100">
            {isFund ? "Fund Vault" : "Withdraw from Vault"}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 transition p-1"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Warning banner */}
      <div className={`mb-5 flex gap-3 px-4 py-3 rounded-xl border text-sm ${
        isFund
          ? "bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200"
          : "bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200"
      }`}>
        <span className="text-base flex-shrink-0">{isFund ? "ℹ️" : "⚠️"}</span>
        <span>
          {isFund
            ? "USDC will be transferred from your wallet to the PolicyVault contract. The agent uses this reserve to supply collateral when your health factor drops."
            : "Withdraws idle USDC from the vault back to your wallet. This goes through the PolicyVault firewall — cooldown and health factor rules still apply. Only idle USDC (not aUSDC in Aave) can be moved this way."
          }
        </span>
      </div>

      {/* Token display */}
      <div className="mb-4">
        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Token</p>
        <TokenBadge
          balance={isFund ? userUsdc : vaultUsdc}
          label={isFund ? "Your wallet" : "Vault available"}
        />
      </div>

      {/* Amount input */}
      <div className="mb-5">
        <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1.5">Amount</p>
        <div className="flex items-center gap-2">
          <input
            type="number"
            min="0.01"
            step="1"
            value={amount}
            onChange={e => { setAmount(e.target.value); setSubmitError(null); }}
            placeholder="0.00"
            className={`flex-1 text-sm bg-gray-50 dark:bg-slate-800 border rounded-xl px-3 py-2.5 text-gray-900 dark:text-slate-100 placeholder-gray-300 dark:placeholder-slate-600 focus:outline-none transition ${
              overMax
                ? "border-red-400 dark:border-red-500 focus:border-red-400"
                : "border-gray-200 dark:border-slate-600 focus:border-blue-400 dark:focus:border-blue-500"
            }`}
          />
          <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">USDC</span>
          {maxAmount != null && maxAmount > 0 && (
            <button
              onClick={() => setAmount(maxAmount.toFixed(2))}
              className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold transition ${
                isFund
                  ? "bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800"
                  : "bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-800"
              }`}
            >
              Max
            </button>
          )}
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <p className="text-xs text-gray-400 dark:text-slate-500">
            Available: {maxAmount != null ? `${maxAmount.toLocaleString("en-US", { maximumFractionDigits: 2 })} USDC` : "—"}
          </p>
          {overMax && (
            <p className="text-xs text-red-500 dark:text-red-400 font-medium">Exceeds balance</p>
          )}
        </div>
      </div>

      {/* Error */}
      {submitError && (
        <div className="mb-4 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-300">
          {submitError}
        </div>
      )}

      {/* Success */}
      {isSuccess && (
        <div className="mb-4 px-3 py-2.5 rounded-xl bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-sm text-green-800 dark:text-green-300 font-medium flex items-center gap-2">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          {isFund ? "USDC sent to vault successfully." : "USDC withdrawn to your wallet."}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onClose}
          className="flex-1 px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-600 text-sm font-semibold text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={disabled}
          className={`flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-semibold disabled:opacity-40 transition ${accentClass}`}
        >
          {isPending   ? "Confirm in wallet…"
          : isConfirming ? "Processing…"
          : isSuccess    ? "Done"
          : isFund       ? "Fund vault"
          :                "Withdraw USDC"}
        </button>
      </div>
    </>
  );
}

// ── Portal wrapper ────────────────────────────────────────────────────────────
export default function VaultModal({ mode, vaultUsdc, onClose, onSuccess }) {
  // Close on Escape key
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Card */}
      <div className="relative z-10 w-full max-w-md glass-card rounded-2xl border border-gray-200 dark:border-slate-700 shadow-2xl p-6">
        <ModalContent
          mode={mode}
          vaultUsdc={vaultUsdc}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      </div>
    </div>,
    document.body
  );
}
