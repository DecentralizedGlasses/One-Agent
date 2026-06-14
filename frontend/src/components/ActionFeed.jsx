import { useEffect, useState } from "react";

const AGENT_URL  = import.meta.env.VITE_AGENT_URL || "http://localhost:3001";
const ROGUE_TARGET = "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045";

export default function ActionFeed() {
  const [log,         setLog]         = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [rogueAmount, setRogueAmount] = useState("1000");
  const [lastResult,  setLastResult]  = useState(null);

  async function fetchLog() {
    const res = await fetch(`${AGENT_URL}/log`).catch(() => null);
    if (res?.ok) setLog(await res.json());
  }

  async function triggerRogueTransfer() {
    setLoading(true);
    setLastResult(null);
    const res = await fetch(`${AGENT_URL}/rogue-transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: ROGUE_TARGET, amount: Number(rogueAmount) }),
    }).catch(() => null);
    if (res?.ok) setLastResult(await res.json());
    await fetchLog();
    setLoading(false);
  }

  async function triggerRun() {
    setLoading(true);
    await fetch(`${AGENT_URL}/run`, { method: "POST" }).catch(() => null);
    await fetchLog();
    setLoading(false);
  }

  async function triggerViolation() {
    setLoading(true);
    await fetch(`${AGENT_URL}/violate`, { method: "POST" }).catch(() => null);
    await fetchLog();
    setLoading(false);
  }

  useEffect(() => {
    fetchLog();
    const id = setInterval(fetchLog, 5000);
    return () => clearInterval(id);
  }, []);

  const amountNum = Number(rogueAmount) || 0;
  const willBlock = amountNum > 500;

  return (
    <div className="space-y-4">

      {/* ── Hero: Rogue Transfer Demo ── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">
            Firewall Demo
          </h2>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
            Simulate an AI agent trying to send USDC to an external wallet. The PolicyVault intercepts it on-chain before any funds move.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
          <div className="space-y-1 flex-1">
            <label className="text-xs font-medium text-gray-500 dark:text-slate-400">
              Amount the agent tries to send (USDC)
            </label>
            <input
              type="number"
              min="1"
              value={rogueAmount}
              onChange={e => setRogueAmount(e.target.value)}
              className="w-full bg-gray-50 dark:bg-slate-800 border border-gray-300 dark:border-slate-700 rounded px-3 py-2 text-sm text-gray-900 dark:text-slate-100 focus:outline-none focus:border-brand"
            />
            <p className="text-xs text-gray-400 dark:text-slate-500">
              Destination: {ROGUE_TARGET.slice(0, 6)}…{ROGUE_TARGET.slice(-4)} &nbsp;·&nbsp; Policy cap: $500
            </p>
          </div>

          <button
            onClick={triggerRogueTransfer}
            disabled={loading || !rogueAmount}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-40 text-white ${
              willBlock ? "bg-red-600 hover:bg-red-500" : "bg-green-600 hover:bg-green-500"
            }`}
          >
            {loading ? "Submitting…" : willBlock ? "Attack (will be blocked)" : "Send (within cap)"}
          </button>
        </div>

        {/* Result banner */}
        {lastResult && (
          <div className={`rounded-lg px-4 py-3 text-sm font-semibold ${
            lastResult.blocked
              ? "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 border border-red-300 dark:border-red-700"
              : "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 border border-green-300 dark:border-green-700"
          }`}>
            {lastResult.blocked
              ? `✗ BLOCKED on-chain — [${lastResult.rule}] $${lastResult.requested} USDC exceeds $${lastResult.limit} policy cap`
              : `✓ Allowed — $${rogueAmount} USDC transfer passed all policy checks`}
          </div>
        )}
      </div>

      {/* ── Action Log ── */}
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 border border-gray-200 dark:border-slate-700 shadow-sm space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider">Agent Action Log</h2>
          <div className="flex gap-2">
            <button
              onClick={triggerRun}
              disabled={loading}
              className="px-3 py-1 text-xs bg-brand text-white rounded hover:bg-indigo-500 disabled:opacity-40 transition"
            >
              Run Agent
            </button>
            <button
              onClick={triggerViolation}
              disabled={loading}
              className="px-3 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-500 disabled:opacity-40 transition"
            >
              Blacklist Violation
            </button>
          </div>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {log.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-slate-500">No actions yet.</p>
          ) : (
            log.map((entry, i) => <LogEntry key={i} entry={entry} />)
          )}
        </div>
      </div>
    </div>
  );
}

function LogEntry({ entry }) {
  const isAllowed = entry.status === "allowed";
  const isBlocked = entry.status === "blocked";

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg text-sm ${
      isAllowed ? "bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-700"
      : isBlocked ? "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-700"
      : "bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700"
    }`}>
      <span className="text-base">{isAllowed ? "✓" : isBlocked ? "✗" : "·"}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-xs font-bold uppercase ${
            isAllowed ? "text-green-700 dark:text-green-300"
            : isBlocked ? "text-red-700 dark:text-red-300"
            : "text-gray-500 dark:text-slate-400"
          }`}>{entry.status}</span>
          <span className="text-xs text-gray-400 dark:text-slate-500">{new Date(entry.ts).toLocaleTimeString()}</span>
        </div>
        <p className="text-gray-700 dark:text-slate-200 text-xs truncate">
          {entry.decision?.action === "transfer"
            ? `Transfer $${entry.decision.amount} USDC — ${entry.reason}`
            : entry.decision?.action
              ? `${entry.decision.action}${entry.decision.amount ? ` $${entry.decision.amount} USDC` : ""} — ${entry.decision.reason ?? entry.reason}`
              : entry.reason ?? "—"}
        </p>
        {entry.hash && (
          <a href={`https://sepolia.etherscan.io/tx/${entry.hash}`} target="_blank" rel="noreferrer"
            className="text-xs text-brand hover:underline">
            {entry.hash.slice(0, 10)}… ↗
          </a>
        )}
      </div>
    </div>
  );
}
