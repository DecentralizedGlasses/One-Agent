import { useEffect, useState } from "react";

const AGENT_URL = import.meta.env.VITE_AGENT_URL || "http://localhost:3001";

export default function EthPriceTarget() {
  const [ethPrice,   setEthPrice]   = useState(null);
  const [target,     setTarget]     = useState(null);  // server state
  const [mode,       setMode]       = useState("absolute"); // "absolute" | "percent"
  const [targetUSD,  setTargetUSD]  = useState("");
  const [targetPct,  setTargetPct]  = useState("");
  const [saving,     setSaving]     = useState(false);
  const [showBanner, setShowBanner] = useState(false);

  async function fetchPrice() {
    const res = await fetch(`${AGENT_URL}/eth-price`).catch(() => null);
    if (res?.ok) {
      const d = await res.json();
      if (!d.error) setEthPrice(d.priceUSD);
    }
  }

  async function fetchTarget() {
    const res = await fetch(`${AGENT_URL}/price-target`).catch(() => null);
    if (res?.ok) {
      const d = await res.json();
      setTarget(d);
      if (d.enabled) {
        setMode(d.mode);
        if (d.mode === "absolute") setTargetUSD(String(d.targetUSD ?? ""));
        if (d.mode === "percent")  setTargetPct(String(d.targetPct ?? ""));
      }
    }
  }

  useEffect(() => {
    fetchPrice();
    fetchTarget();
    const priceId  = setInterval(fetchPrice,  30_000);
    const targetId = setInterval(fetchTarget, 10_000);
    return () => { clearInterval(priceId); clearInterval(targetId); };
  }, []);

  async function save() {
    setSaving(true);
    const body = mode === "absolute"
      ? { mode: "absolute", targetUSD: Number(targetUSD), enabled: true }
      : { mode: "percent",  targetPct: Number(targetPct),  enabled: true };
    const res = await fetch(`${AGENT_URL}/price-target`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    if (res?.ok) {
      const d = await res.json();
      setTarget(d);
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 4000);
    }
    setSaving(false);
  }

  async function disable() {
    await fetch(`${AGENT_URL}/price-target`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: false }),
    }).catch(() => null);
    await fetchTarget();
  }

  async function reset() {
    await fetch(`${AGENT_URL}/price-target/reset`, { method: "POST" }).catch(() => null);
    await fetchTarget();
  }

  // Compute the effective trigger price for display
  const triggerPrice = target?.enabled
    ? target.mode === "percent"
      ? target.baselineUSD * (1 + target.targetPct / 100)
      : target.targetUSD
    : null;

  const pctFromTarget = ethPrice && triggerPrice
    ? ((triggerPrice - ethPrice) / ethPrice * 100)
    : null;

  return (
    <div className="glass-card rounded-2xl border border-gray-200 dark:border-slate-700 p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-lg">📈</span>
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">ETH sell trigger</h2>
        </div>
        {target?.enabled && (
          <button
            onClick={disable}
            className="text-xs text-gray-400 dark:text-slate-500 hover:text-red-500 dark:hover:text-red-400 font-medium transition"
          >
            Disable
          </button>
        )}
      </div>
      <p className="text-xs text-gray-400 dark:text-slate-500 mb-4">
        Monitor logs an alert in the feed when ETH hits your target price.
      </p>

      {/* Live ETH price */}
      <div className="flex items-center justify-between mb-4 px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700">
        <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">ETH / USD (Chainlink)</span>
        <span className="text-sm font-bold text-gray-900 dark:text-slate-100">
          {ethPrice != null ? `$${ethPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
        </span>
      </div>

      {/* Status banner when triggered */}
      {target?.triggered && (
        <div className="mb-4 px-3 py-2.5 rounded-xl bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-green-800 dark:text-green-300">
                Target hit at ${target.triggeredPrice?.toFixed(2)}
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-0.5">
                Check the action feed for details.
              </p>
            </div>
            <button
              onClick={reset}
              className="text-xs px-2 py-1 rounded-lg bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800 font-medium transition"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Watching status */}
      {target?.enabled && !target?.triggered && triggerPrice && (
        <div className="mb-4 px-3 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
          <p className="text-xs font-semibold text-blue-800 dark:text-blue-300">
            Watching — trigger at ${triggerPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          {pctFromTarget != null && (
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
              {pctFromTarget > 0
                ? `ETH needs to rise ${pctFromTarget.toFixed(1)}% to trigger`
                : `Price already above target — reset to re-arm`}
            </p>
          )}
        </div>
      )}

      {/* Success banner */}
      {showBanner && (
        <div className="mb-4 px-3 py-2 rounded-xl bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 text-xs text-green-800 dark:text-green-300 font-medium">
          ✓ Price target set — monitor checks every 60s.
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex gap-1 mb-3 p-1 bg-gray-100 dark:bg-slate-800 rounded-lg">
        {["absolute", "percent"].map(m => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 text-xs py-1.5 rounded-md font-medium transition ${
              mode === m
                ? "bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm"
                : "text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
            }`}
          >
            {m === "absolute" ? "At price" : "% gain"}
          </button>
        ))}
      </div>

      {/* Input */}
      {mode === "absolute" ? (
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-gray-400 dark:text-slate-500 font-medium">$</span>
          <input
            type="number"
            min="0"
            step="10"
            value={targetUSD}
            onChange={e => setTargetUSD(e.target.value)}
            placeholder={ethPrice ? `e.g. ${Math.round(ethPrice * 1.1).toLocaleString()}` : "e.g. 4000"}
            className="flex-1 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-gray-900 dark:text-slate-100 placeholder-gray-300 dark:placeholder-slate-600 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500"
          />
          <span className="text-xs text-gray-400 dark:text-slate-500">USD</span>
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-4">
          <input
            type="number"
            min="0.1"
            step="0.5"
            value={targetPct}
            onChange={e => setTargetPct(e.target.value)}
            placeholder="e.g. 10"
            className="flex-1 text-sm bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 text-gray-900 dark:text-slate-100 placeholder-gray-300 dark:placeholder-slate-600 focus:outline-none focus:border-blue-400 dark:focus:border-blue-500"
          />
          <span className="text-xs text-gray-400 dark:text-slate-500">% gain from current</span>
        </div>
      )}

      {/* Preview */}
      {ethPrice && (
        <p className="text-xs text-gray-400 dark:text-slate-500 mb-3">
          {mode === "absolute" && targetUSD
            ? `Trigger when ETH ≥ $${Number(targetUSD).toLocaleString()} (current $${ethPrice.toFixed(2)})`
            : mode === "percent" && targetPct
            ? `Trigger at $${(ethPrice * (1 + Number(targetPct) / 100)).toFixed(2)} (+${targetPct}% from $${ethPrice.toFixed(2)})`
            : "Enter a target to preview"}
        </p>
      )}

      {/* Save button */}
      <button
        onClick={save}
        disabled={saving || (mode === "absolute" ? !targetUSD : !targetPct)}
        className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold disabled:opacity-40 transition"
      >
        {saving ? "Saving…" : target?.enabled ? "Update target" : "Set & watch"}
      </button>
    </div>
  );
}
