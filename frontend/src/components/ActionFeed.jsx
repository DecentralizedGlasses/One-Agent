import { useEffect, useState } from "react";

const AGENT_URL = import.meta.env.VITE_AGENT_URL || "http://localhost:3001";

export default function ActionFeed() {
  const [log, setLog] = useState([]);
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
    <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Action feed</p>
          <h3 className="mt-2 text-2xl font-semibold text-slate-950">Recent agent activity</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={triggerRun}
            disabled={loading}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Run agent
          </button>
          <button
            onClick={triggerViolation}
            disabled={loading}
            className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Demo violation
          </button>
        </div>
      </div>

      <div className="space-y-4 max-h-[720px] overflow-y-auto pr-1">
        {log.length === 0 && (
          <p className="text-sm text-slate-500">No actions yet. Run the agent to see the latest events.</p>
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
    <div className={`rounded-3xl border px-4 py-4 ${
      isAllowed ? "border-emerald-100 bg-emerald-50"
      : isBlocked ? "border-rose-100 bg-rose-50"
      : "border-slate-200 bg-slate-50"
    }`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={`inline-flex h-3.5 w-3.5 rounded-full ${
            isAllowed ? "bg-emerald-500"
            : isBlocked ? "bg-rose-500"
            : "bg-slate-400"
          }`} />
          <div>
            <p className="text-sm font-semibold text-slate-900">{entry.reason ?? entry.decision?.action ?? "Agent event"}</p>
            <p className="text-xs text-slate-500">{new Date(entry.ts).toLocaleTimeString()}</p>
          </div>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${
          isAllowed ? "bg-emerald-100 text-emerald-700"
          : isBlocked ? "bg-rose-100 text-rose-700"
          : "bg-slate-100 text-slate-700"
        }`}>{entry.status}</span>
      </div>
      {entry.hash && (
        <a
          href={`https://sepolia.basescan.org/tx/${entry.hash}`}
          target="_blank"
          rel="noreferrer"
          className="mt-3 block text-sm text-slate-600 hover:text-slate-900"
        >
          {entry.hash.slice(0, 10)}…
        </a>
      )}
    </div>
  );
}
