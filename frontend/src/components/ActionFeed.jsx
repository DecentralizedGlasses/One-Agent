import { useEffect, useState } from "react";
import { useAccount } from "wagmi";

const AGENT_URL = import.meta.env.VITE_AGENT_URL || "http://localhost:3001";
const BASESCAN  = "https://sepolia.basescan.org/tx/";

const RULE_ORDER = ["KillSwitch", "Whitelist", "SpendCap", "Cooldown", "HealthFactor", "PriceFloor"];

export default function ActionFeed({ agentRevoked = false, onLog }) {
  const { address } = useAccount();
  const [log,         setLog]         = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [demoResult,  setDemoResult]  = useState(null);
  const [selected,    setSelected]    = useState(null);

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
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-200 dark:border-slate-700 p-5 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">⚡</span>
          <h2 className="text-base font-semibold text-gray-900 dark:text-slate-100">Agent action feed</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={triggerRun}
            disabled={loading || agentRevoked}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 text-gray-700 dark:text-slate-300 disabled:opacity-40 transition"
          >
            {loading ? "Running…" : "Run agent"}
          </button>
          <button
            onClick={triggerDemo}
            disabled={demoLoading || agentRevoked}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-100 dark:bg-orange-900 hover:bg-orange-200 dark:hover:bg-orange-800 text-orange-700 dark:text-orange-300 disabled:opacity-40 transition"
          >
            {demoLoading ? "Testing…" : "Test firewall"}
          </button>
        </div>
      </div>

      {agentRevoked && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 text-xs text-red-700 dark:text-red-400 font-medium">
          Agent is revoked — all actions blocked
        </div>
      )}

      {!agentRevoked && log.length > 0 && log[0]?.rule === "CallFailed" && (
        <div className="mb-3 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
          <span className="font-semibold">Vault needs USDC.</span> Send USDC on Base Sepolia to the vault address to enable agent actions.
        </div>
      )}

      {demoResult && (
        <div className={`mb-3 px-3 py-2 rounded-xl text-xs font-medium border ${
          demoResult.status === "blocked"
            ? "bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300"
            : "bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300"
        }`}>
          {demoResult.status === "blocked"
            ? `🔒 Blocked [${demoResult.rule}]: ${demoResult.reason}`
            : `✓ Allowed: ${demoResult.decision?.reason}`}
        </div>
      )}

      {/* Feed */}
      <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-slate-700 max-h-[480px]">
        {log.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500 py-4">No actions yet — click "Run agent" to start.</p>
        ) : (
          log.map((entry, i) => (
            <FeedEntry
              key={i}
              entry={entry}
              expanded={selected === i}
              onToggle={() => setSelected(prev => prev === i ? null : i)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ── Feed row ──────────────────────────────────────────────────────────── */

function FeedEntry({ entry, expanded, onToggle }) {
  const { dot, badge, badgeStyle, text, detail } = formatEntry(entry);

  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full text-left py-3 hover:bg-gray-50 dark:hover:bg-slate-800 rounded-lg px-1 -mx-1 transition"
      >
        <div className="flex items-start gap-2.5">
          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dot}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm text-gray-900 dark:text-slate-100">{text}</span>
              {badge && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeStyle}`}>{badge}</span>
              )}
              <span className="ml-auto text-[10px] text-gray-400 dark:text-slate-500 flex-shrink-0 font-medium">
                {expanded ? "▲ hide" : "▼ report"}
              </span>
            </div>
            {detail && <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{detail}</p>}
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{relativeTime(entry.ts)}</p>
          </div>
        </div>
      </button>

      {expanded && <DetailReport entry={entry} />}
    </div>
  );
}

/* ── Detail report ─────────────────────────────────────────────────────── */

function DetailReport({ entry }) {
  const ts        = entry.ts ? new Date(entry.ts).toLocaleString() : "—";
  const isBlocked  = entry.status === "blocked";
  const isAllowed  = entry.status === "allowed";
  const isAlert    = entry.status === "alert";
  const isSellHit  = entry.status === "sell_triggered";

  return (
    <div className="mb-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-xs overflow-hidden divide-y divide-gray-200 dark:divide-slate-700">

      {/* Header row */}
      <div className="px-4 py-3 flex items-center justify-between gap-2 bg-white dark:bg-slate-900">
        <div>
          <p className="font-semibold text-gray-800 dark:text-slate-100 text-sm">Action Report</p>
          <p className="text-gray-400 dark:text-slate-500 mt-0.5">{ts}</p>
        </div>
        <StatusBadge entry={entry} />
      </div>

      {/* 1. Aave position snapshot */}
      {(entry.healthFactor != null || entry.collateralUSD != null) && (
        <Section title="Aave position snapshot">
          <SnapshotGrid>
            <SnapshotCell
              label="Health Factor"
              value={entry.healthFactor != null ? entry.healthFactor.toFixed(4) : "—"}
              sub={hfLabel(entry.healthFactor)}
              valueColor={hfColor(entry.healthFactor)}
            />
            <SnapshotCell
              label="Total Collateral"
              value={entry.collateralUSD != null ? `$${entry.collateralUSD.toFixed(2)}` : "—"}
            />
            <SnapshotCell
              label="Total Debt"
              value={entry.debtUSD != null ? `$${entry.debtUSD.toFixed(2)}` : "—"}
            />
          </SnapshotGrid>
        </Section>
      )}

      {/* 2. Vault balances */}
      {(entry.vaultUsdc != null || entry.vaultAusdc != null) && (
        <Section title="Vault balances at run time">
          <SnapshotGrid>
            <SnapshotCell label="USDC (idle)"       value={entry.vaultUsdc  != null ? `${entry.vaultUsdc.toLocaleString()} USDC`  : "—"} />
            <SnapshotCell label="aUSDC (in Aave)"   value={entry.vaultAusdc != null ? `${entry.vaultAusdc.toLocaleString()} aUSDC` : "—"} />
            {entry.maxTxUsdc != null && (
              <SnapshotCell label="Spend cap" value={`${entry.maxTxUsdc.toLocaleString()} USDC`} />
            )}
          </SnapshotGrid>
        </Section>
      )}

      {/* 3. Agent decision */}
      {entry.decision && (entry.decision.action || entry.decision.amount != null) && (
        <Section title="Claude's decision">
          <div className="flex gap-3 mb-2">
            <Pill color={entry.decision.action === "supply" ? "blue" : "purple"}>
              {cap(entry.decision.action)}
            </Pill>
            {entry.decision.amount != null && (
              <Pill color="gray">{entry.decision.amount} USDC</Pill>
            )}
          </div>
          {entry.decision.reason && (
            <p className="text-gray-700 dark:text-slate-300 leading-relaxed">{entry.decision.reason}</p>
          )}
        </Section>
      )}

      {/* 4. Firewall rules */}
      <Section title="PolicyVault firewall — 6 rules">
        <FirewallTable entry={entry} />
      </Section>

      {/* 5. Alert detail */}
      {isAlert && (
        <Section title="Monitor alert detail">
          <p className="text-orange-700 dark:text-orange-400 leading-relaxed">{entry.reason}</p>
        </Section>
      )}

      {/* 5b. ETH sell trigger detail */}
      {isSellHit && (
        <Section title="ETH price target">
          <SnapshotGrid>
            <SnapshotCell
              label="ETH price at trigger"
              value={`$${entry.ethPrice?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              valueColor="text-emerald-600 dark:text-emerald-400"
            />
            <SnapshotCell
              label="Target price"
              value={`$${entry.triggerPrice?.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
            <SnapshotCell
              label="Mode"
              value={entry.mode === "percent" ? `+${entry.targetPct}% gain` : "Absolute price"}
            />
          </SnapshotGrid>
          {entry.ethBalance > 0 && (
            <div className="mt-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300">
              Vault holds <span className="font-semibold">{entry.ethBalance?.toFixed(4)} ETH</span> worth{" "}
              <span className="font-semibold">${entry.usdValue?.toLocaleString("en-US", { maximumFractionDigits: 2 })}</span> at trigger price.
            </div>
          )}
          {entry.ethBalance === 0 && (
            <p className="mt-2 text-gray-500 dark:text-slate-400">Vault holds no ETH. Send ETH to the vault address to enable automatic sells.</p>
          )}
        </Section>
      )}

      {/* 6. Transaction */}
      {isAllowed && entry.hash && (
        <Section title="On-chain transaction">
          <div className="flex items-start gap-3">
            <div className="flex-1 font-mono text-gray-600 dark:text-slate-400 break-all leading-relaxed">{entry.hash}</div>
            <a
              href={`${BASESCAN}${entry.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700 transition text-xs"
            >
              View on Basescan ↗
            </a>
          </div>
        </Section>
      )}
    </div>
  );
}

/* ── Firewall table ────────────────────────────────────────────────────── */

const RULE_META = {
  KillSwitch:   { label: "Kill switch",        desc: "Agent is not emergency-revoked" },
  Whitelist:    { label: "Protocol whitelist",  desc: "Target contract is on approved list" },
  SpendCap:     { label: "Spend cap",           desc: "Amount ≤ per-transaction limit" },
  Cooldown:     { label: "Cooldown",            desc: "Enough time elapsed since last action" },
  HealthFactor: { label: "Health factor",       desc: "Aave HF above configured floor" },
  PriceFloor:   { label: "ETH price floor",     desc: "ETH/USD above configured minimum (Chainlink)" },
};

function FirewallTable({ entry }) {
  const blockedAt = entry.status === "blocked" ? RULE_ORDER.indexOf(entry.rule) : -1;

  return (
    <div className="space-y-1">
      {RULE_ORDER.map((rule, i) => {
        let state;
        if (entry.status === "allowed") {
          state = "pass";
        } else if (entry.status === "blocked") {
          if (i < blockedAt)    state = "pass";
          else if (i === blockedAt) state = "fail";
          else                  state = "skip";
        } else {
          state = "skip";
        }

        const meta = RULE_META[rule] ?? { label: rule, desc: "" };
        return (
          <div key={rule} className={`flex items-start gap-2.5 px-2 py-1.5 rounded-lg ${
            state === "fail" ? "bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800" : ""
          }`}>
            <RuleIcon state={state} />
            <div className="flex-1 min-w-0">
              <span className={`font-semibold ${
                state === "fail" ? "text-red-700 dark:text-red-400" :
                state === "pass" ? "text-gray-800 dark:text-slate-200" :
                "text-gray-400 dark:text-slate-600"
              }`}>{meta.label}</span>
              <span className={`ml-2 ${
                state === "fail" ? "text-red-600 dark:text-red-400" :
                state === "pass" ? "text-gray-500 dark:text-slate-400" :
                "text-gray-300 dark:text-slate-600"
              }`}>{meta.desc}</span>
              {state === "fail" && entry.reason && (
                <p className="text-red-600 dark:text-red-400 mt-0.5 leading-relaxed">{entry.reason}</p>
              )}
            </div>
            <RuleStateLabel state={state} />
          </div>
        );
      })}
    </div>
  );
}

function RuleIcon({ state }) {
  if (state === "pass") return <span className="text-green-500 font-bold mt-0.5">✓</span>;
  if (state === "fail") return <span className="text-red-500 font-bold mt-0.5">✗</span>;
  return <span className="text-gray-300 dark:text-slate-600 mt-0.5">—</span>;
}

function RuleStateLabel({ state }) {
  if (state === "pass") return <span className="text-green-600 dark:text-green-400 font-semibold flex-shrink-0">passed</span>;
  if (state === "fail") return <span className="text-red-600 dark:text-red-400 font-semibold flex-shrink-0">blocked</span>;
  return <span className="text-gray-300 dark:text-slate-600 flex-shrink-0">—</span>;
}

/* ── Sub-components ────────────────────────────────────────────────────── */

function Section({ title, children }) {
  return (
    <div className="px-4 py-3">
      <p className="text-[10px] font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-2.5">{title}</p>
      {children}
    </div>
  );
}

function SnapshotGrid({ children }) {
  return <div className="grid grid-cols-3 gap-2">{children}</div>;
}

function SnapshotCell({ label, value, sub, valueColor = "text-gray-800 dark:text-slate-200" }) {
  return (
    <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-700 px-3 py-2">
      <p className="text-[10px] text-gray-400 dark:text-slate-500 mb-1">{label}</p>
      <p className={`font-semibold text-sm ${valueColor}`}>{value}</p>
      {sub && <p className="text-[10px] text-gray-400 dark:text-slate-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function Pill({ color, children }) {
  const cls = {
    blue:   "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300",
    purple: "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300",
    gray:   "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300",
  }[color] ?? "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300";
  return <span className={`px-2.5 py-1 rounded-full font-semibold ${cls}`}>{children}</span>;
}

function StatusBadge({ entry }) {
  const map = {
    allowed:         { label: "Executed",      cls: "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700"       },
    blocked:         { label: "Blocked",       cls: "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700"                   },
    idle:            { label: "No action",     cls: "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700"             },
    alert:           { label: "Alert",         cls: "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700" },
    revoked:         { label: "Revoked",       cls: "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700"                   },
    sell_triggered:  { label: "Sell triggered",cls: "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-700" },
  };
  const { label, cls } = map[entry.status] ?? { label: entry.status, cls: "bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300 border-gray-200 dark:border-slate-600" };
  return <span className={`px-3 py-1 rounded-full font-bold border text-sm ${cls}`}>{label}</span>;
}

/* ── Helpers ───────────────────────────────────────────────────────────── */

function hfColor(hf) {
  if (hf === null) return "text-gray-400 dark:text-slate-500";
  if (hf >= 2)     return "text-green-700 dark:text-green-400";
  if (hf >= 1.5)   return "text-yellow-600 dark:text-yellow-400";
  return "text-red-600 dark:text-red-400";
}

function hfLabel(hf) {
  if (hf === null) return null;
  if (hf >= 2)     return "Safe";
  if (hf >= 1.5)   return "Caution";
  return "At risk";
}

function formatEntry(entry) {
  if (entry.status === "alert") {
    const hf = entry.decision?.healthFactor;
    return {
      dot: "bg-orange-500",
      badge: "⚠ alert",
      badgeStyle: "bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300",
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
    return { dot: "bg-red-500", badge: "blocked", badgeStyle: "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300", text };
  }
  if (entry.status === "allowed") {
    const act  = entry.decision?.action;
    const amt  = entry.decision?.amount;
    const text = act && amt ? `${cap(act)} ${amt} USDC` : "Action executed";
    return { dot: "bg-green-500", badge: "executed", badgeStyle: "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300", text };
  }
  if (entry.status === "idle") {
    return { dot: "bg-blue-500", badge: "ok", badgeStyle: "bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300", text: "Agent scanned position — no action needed" };
  }
  if (entry.status === "revoked") {
    return { dot: "bg-red-500", badge: "killed", badgeStyle: "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300", text: "Kill switch triggered — session revoked" };
  }
  if (entry.status === "sell_triggered") {
    return {
      dot: "bg-emerald-500",
      badge: "sell triggered",
      badgeStyle: "bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300",
      text: `ETH hit $${entry.ethPrice?.toLocaleString("en-US", { maximumFractionDigits: 2 })} — price target reached`,
    };
  }
  return { dot: "bg-gray-400", badge: null, badgeStyle: "", text: entry.reason ?? "Agent action" };
}

function cap(str) { return str ? str.charAt(0).toUpperCase() + str.slice(1) : ""; }

function relativeTime(ts) {
  const diff = Date.now() - ts;
  if (diff < 60000)    return "just now";
  if (diff < 3600000)  return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hr ago`;
  return new Date(ts).toLocaleDateString();
}
