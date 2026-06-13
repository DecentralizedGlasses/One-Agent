import { useEffect, useState } from "react";

const AGENT_URL = import.meta.env.VITE_AGENT_URL || "http://localhost:3001";

export default function ActionFeed() {
  const [log,     setLog]     = useState([]);
  const [loading, setLoading] = useState(false);

  async function fetchLog() {
    const res = await fetch(`${AGENT_URL}/log`).catch(() => null);
    if (res?.ok) setLog(await res.json());
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

  return (
    <div className="bg-white rounded-xl p-5 space-y-4 border border-gray-200 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">Agent Action Feed</h2>
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
            Demo Violation
          </button>
        </div>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {log.length === 0 && (
          <p className="text-sm text-gray-400">No actions yet — click "Run Agent" to start.</p>
        )}
        {log.map((entry, i) => (
          <LogEntry key={i} entry={entry} />
        ))}
      </div>
    </div>
  );
}

function LogEntry({ entry }) {
  const isAllowed = entry.status === "allowed";
  const isBlocked = entry.status === "blocked";

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg text-sm ${
      isAllowed ? "bg-green-50 border border-green-200"
      : isBlocked ? "bg-red-50 border border-red-200"
      : "bg-gray-50 border border-gray-200"
    }`}>
      <span className="text-lg">{isAllowed ? "✓" : isBlocked ? "✗" : "?"}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-bold uppercase ${
            isAllowed ? "text-green-700" : isBlocked ? "text-red-700" : "text-gray-500"
          }`}>
            {entry.status}
          </span>
          <span className="text-xs text-gray-400">{new Date(entry.ts).toLocaleTimeString()}</span>
        </div>
        <p className="text-gray-700 truncate">
          {entry.decision?.action
            ? `${entry.decision.action} ${entry.decision.amount ?? ""} USDC — ${entry.decision.reason}`
            : entry.reason ?? "—"}
        </p>
        {entry.hash && (
          <a
            href={`https://sepolia.basescan.org/tx/${entry.hash}`}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-brand hover:underline"
          >
            {entry.hash.slice(0, 10)}…
          </a>
        )}
      </div>
    </div>
  );
}
