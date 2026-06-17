import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

const AGENT_URL = import.meta.env.VITE_AGENT_URL || "http://localhost:3001";

export default function ActionFeed({ agentRevoked = false, onLog }) {
  const { address } = useAccount();
  const [log,     setLog]     = useState([]);
  const [loading, setLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoResult, setDemoResult]   = useState(null);

  async function fetchLog() {
    const res = await fetch(`${AGENT_URL}/log`).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setLog(data);
      onLog?.(data);
    }
  }

  async function triggerRun() {
    setLoading(true);
    await fetch(`${AGENT_URL}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    }).catch(() => null);
    await fetchLog();
    setLoading(false);
  }

  async function triggerDemo() {
    setDemoResult(null);
    setDemoLoading(true);
    const res = await fetch(`${AGENT_URL}/run-demo`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address }),
    }).catch(() => null);
    const data = res?.ok ? await res.json() : null;
    await fetchLog();
    setDemoResult(data);
    setDemoLoading(false);
  }

  useEffect(() => {
    fetchLog();
    const id = setInterval(fetchLog, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <h2 className="text-base font-semibold text-gray-900">Agent action feed</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={triggerRun}
            disabled={loading || agentRevoked}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 disabled:opacity-40 transition"
          >
            {loading ? "Running…" : "Run agent"}
          </button>
          <button
            onClick={triggerDemo}
            disabled={demoLoading || agentRevoked}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-700 disabled:opacity-40 transition"
          >
            {demoLoading ? "Testing…" : "Test firewall"}
          </button>
        </div>
      </div>

      {agentRevoked && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
          Agent is revoked — all actions blocked
        </div>
      )}

      {!agentRevoked && log.length > 0 && log[0]?.rule === "CallFailed" && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
          <span className="font-semibold">Vault needs USDC.</span> Send USDC on Base Sepolia to the vault address to enable agent actions.
        </div>
      )}

      {/* Demo result banner */}
      {demoResult && (
        <div className={`mb-3 px-3 py-2 rounded-xl text-xs font-medium border ${
          demoResult.status === "blocked"
            ? "bg-red-50 border-red-200 text-red-800"
            : "bg-green-50 border-green-200 text-green-800"
        }`}>
          {demoResult.status === "blocked"
            ? `🔒 Blocked [${demoResult.rule}]: ${demoResult.reason}`
            : `✓ Allowed: ${demoResult.decision?.reason}`}
        </div>
      )}

      {/* Feed */}
      <div className="flex-1 overflow-y-auto space-y-0 divide-y divide-gray-100 max-h-[480px]">
        {log.length === 0 ? (
          <p className="text-sm text-gray-400 py-4">No actions yet — click "Run agent" to start.</p>
        ) : (
          log.map((entry, i) => <FeedEntry key={i} entry={entry} />)
        )}
      </div>
    </div>
  );
}

function FeedEntry({ entry }) {
  const { dot, badge, badgeStyle, text, detail } = formatEntry(entry);

  return (
    <div className="py-3">
      <div className="flex items-start gap-2.5">
        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dot}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-gray-900">{text}</span>
            {badge && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeStyle}`}>{badge}</span>
            )}
          </div>
          {detail && <p className="text-xs text-gray-500 mt-0.5">{detail}</p>}
          <p className="text-xs text-gray-400 mt-0.5">{relativeTime(entry.ts)}</p>
        </div>
      </div>
    </div>
  );
}

function formatEntry(entry) {
  if (entry.status === "alert") {
    const hf = entry.decision?.healthFactor;
    return {
      dot: "bg-orange-500",
      badge: "⚠ alert",
      badgeStyle: "bg-orange-100 text-orange-700",
      text: `Health factor ${hf ? hf.toFixed(2) : "critical"} — owner action needed`,
      detail: entry.reason,
    };
  }
  if (entry.status === "blocked") {
    const act  = entry.decision?.action;
    const amt  = entry.decision?.amount;
    const text = act && amt
      ? `Tried to ${act} ${amt} USDC — ${entry.rule ?? "blocked"}`
      : entry.reason ?? "Blocked by PolicyVault";
    return { dot: "bg-red-500", badge: "blocked", badgeStyle: "bg-red-100 text-red-700", text };
  }
  if (entry.status === "allowed") {
    const act  = entry.decision?.action;
    const amt  = entry.decision?.amount;
    const text = act && amt ? `${cap(act)} ${amt} USDC` : "Action executed";
    return { dot: "bg-green-500", badge: "executed", badgeStyle: "bg-green-100 text-green-700", text };
  }
  if (entry.status === "idle") {
    return { dot: "bg-blue-500", badge: "ok", badgeStyle: "bg-blue-100 text-blue-700", text: "Agent scanned position — no action needed" };
  }
  if (entry.status === "revoked") {
    return { dot: "bg-red-500", badge: "killed", badgeStyle: "bg-red-100 text-red-700", text: "Kill switch triggered — session revoked" };
  }
  return { dot: "bg-gray-400", badge: null, badgeStyle: "", text: entry.reason ?? "Agent action" };
}

function cap(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ""; }

function relativeTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000)  return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hr ago`;
  return new Date(ts).toLocaleDateString();
}
