import { useState, useEffect } from "react";
import { useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain } from "wagmi";
import { VAULT_ADDRESS, VAULT_ABI, VAULT_CHAIN_ID } from "../wagmi";

export default function PolicyPanel() {
  const { data: policy, refetch } = useReadContract({
    address: VAULT_ADDRESS, abi: VAULT_ABI,
    functionName: "getPolicy", chainId: VAULT_CHAIN_ID,
  });

  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContract, isPending, data: txHash } = useWriteContract();
  const { isSuccess } = useWaitForTransactionReceipt({
    hash: txHash, chainId: VAULT_CHAIN_ID,
    query: { enabled: !!txHash },
  });

  const [editing,    setEditing]    = useState(false);
  const [maxTx,      setMaxTx]      = useState("");
  const [cooldown,   setCooldown]   = useState("");
  const [hfFloor,    setHfFloor]    = useState("");
  const [priceFloor, setPriceFloor] = useState("");
  const [optimistic, setOptimistic] = useState(null);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (isSuccess) {
      const saved = { maxTx, cooldown, hfFloor, priceFloor };
      setOptimistic(saved);
      setShowBanner(true);
      setEditing(false);
      refetch();
      setMaxTx(""); setCooldown(""); setHfFloor(""); setPriceFloor("");
      const t = setTimeout(() => setShowBanner(false), 6000);
      return () => clearTimeout(t);
    }
  }, [isSuccess]);

  useEffect(() => {
    if (policy && optimistic) {
      if ((Number(policy[2]) / 1e6).toFixed(0) === optimistic.maxTx) setOptimistic(null);
    }
  }, [policy]);

  const CACHE_KEY = "one-agent-policy";

  useEffect(() => {
    if (!policy) return;
    const cached = {
      maxTx:      (Number(policy[2]) / 1e6).toFixed(0),
      cooldown:   (Number(policy[3]) / 60).toFixed(0),
      hfFloor:    (Number(policy[4]) / 1e18).toFixed(2),
      priceFloor: (Number(policy[5]) / 1e8).toFixed(0),
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cached));
  }, [policy]);

  const cached = (() => {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null"); }
    catch { return null; }
  })();

  const curMax   = optimistic?.maxTx      ?? (policy ? (Number(policy[2]) / 1e6).toFixed(0)  : cached?.maxTx      ?? null);
  const curCd    = optimistic?.cooldown   ?? (policy ? (Number(policy[3]) / 60).toFixed(0)   : cached?.cooldown   ?? null);
  const curHf    = optimistic?.hfFloor    ?? (policy ? (Number(policy[4]) / 1e18).toFixed(2) : cached?.hfFloor    ?? null);
  const curPrice = optimistic?.priceFloor ?? (policy ? (Number(policy[5]) / 1e8).toFixed(0)  : cached?.priceFloor ?? null);

  async function savePolicy() {
    if (chainId !== VAULT_CHAIN_ID) {
      try { await switchChainAsync({ chainId: VAULT_CHAIN_ID }); }
      catch { return; }
    }
    writeContract({
      address: VAULT_ADDRESS, abi: VAULT_ABI, chainId: VAULT_CHAIN_ID,
      functionName: "setPolicy",
      args: [
        BigInt(Math.floor(Number(maxTx)      * 1e6)),
        BigInt(Number(cooldown)              * 60),
        BigInt(Math.floor(Number(hfFloor)    * 1e18)),
        BigInt(Math.floor(Number(priceFloor) * 1e8)),
      ],
    });
  }

  const rules = [
    {
      icon: "$", iconBg: "bg-blue-100 dark:bg-blue-900",
      label: "Max spend per tx",
      display: curMax ? `${curMax} USDC limit` : "—",
      editKey: "maxTx", state: maxTx, set: setMaxTx, placeholder: curMax ?? "500", step: "1", suffix: "USDC",
    },
    {
      icon: "▽", iconBg: "bg-green-100 dark:bg-green-900",
      label: "Aave only",
      display: "Other protocols blocked",
      editKey: null,
    },
    {
      icon: "⏱", iconBg: "bg-amber-100 dark:bg-amber-900",
      label: "Time-lock",
      display: curCd ? `Once per ${curCd} minutes` : "—",
      editKey: "cooldown", state: cooldown, set: setCooldown, placeholder: curCd ?? "30", step: "1", suffix: "minutes",
    },
    {
      icon: "모", iconBg: "bg-red-100 dark:bg-red-900",
      label: "Auto-kill threshold",
      display: curHf ? `Trigger if health < ${curHf}` : "—",
      editKey: "hfFloor", state: hfFloor, set: setHfFloor, placeholder: curHf ?? "1.50", step: "0.01", suffix: "",
    },
    {
      icon: "$", iconBg: "bg-purple-100 dark:bg-purple-900",
      label: "ETH price floor",
      display: curPrice ? `Block if ETH < $${curPrice}` : "—",
      editKey: "priceFloor", state: priceFloor, set: setPriceFloor, placeholder: curPrice ?? "1500", step: "1", suffix: "USD",
    },
  ];

  return (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">☰</span>
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Policy rules</h2>
        </div>
        <button
          onClick={() => { setEditing(!editing); setMaxTx(""); setCooldown(""); setHfFloor(""); setPriceFloor(""); }}
          className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 font-medium"
        >
          {editing ? "Cancel" : "Edit rules"}
        </button>
      </div>

      <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">
        {policy ? "Live from chain · enforced on every agent transaction" : "Connect wallet to load rules"}
      </p>

      {showBanner && (
        <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
          <span className="text-green-600 dark:text-green-400 font-bold">✓</span>
          <p className="text-xs text-green-800 dark:text-green-300 font-medium">Policy saved — new rules are enforced on-chain from now.</p>
        </div>
      )}

      <div className="divide-y divide-gray-100 dark:divide-slate-700">
        {rules.map((rule) => (
          <div key={rule.label} className="flex items-center gap-3 py-3">
            <div className={`w-9 h-9 rounded-xl ${rule.iconBg} flex items-center justify-center text-sm flex-shrink-0 font-semibold`}>
              {rule.icon}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">{rule.label}</p>
              {editing && rule.editKey ? (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <input
                    type="number" step={rule.step} min="0"
                    value={rule.state}
                    onChange={e => rule.set(e.target.value)}
                    placeholder={rule.placeholder}
                    className="w-28 text-xs bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg px-2 py-1 text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500"
                  />
                  {rule.suffix && <span className="text-xs text-gray-400 dark:text-slate-500">{rule.suffix}</span>}
                </div>
              ) : (
                <p className={`text-xs mt-0.5 font-medium ${rule.display === "—" ? "text-gray-300 dark:text-slate-600" : "text-gray-500 dark:text-slate-400"}`}>
                  {rule.display}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <button
          onClick={savePolicy}
          disabled={isPending || !maxTx || !cooldown || !hfFloor || !priceFloor}
          className="mt-4 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-40 transition"
        >
          {isPending ? "Confirm in MetaMask…" : "Save to chain"}
        </button>
      )}
    </div>
  );
}
