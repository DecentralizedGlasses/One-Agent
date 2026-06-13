import {
  Activity,
  Building2,
  CircleDollarSign,
  Clock3,
  Filter,
  ListChecks,
  ShieldCheck,
  Skull,
  Search,
  X,
  Send,
} from "lucide-react";
import { useState } from "react";

const stats = [
  { label: "Total supplied", value: "$8,420", className: "text-blue-600" },
  { label: "Health factor", value: "2.41", className: "text-green-700" },
  { label: "Actions today", value: "7", className: "text-slate-950" },
  { label: "Blocked attempts", value: "2", className: "text-red-800" },
];

const positions = [
  {
    name: "USDC supplied",
    value: "$5,200",
    sub: "3.2% APY",
    valueClass: "text-slate-950",
    subClass: "text-green-700",
  },
  {
    name: "ETH supplied",
    value: "$3,220",
    sub: "1.8% APY",
    valueClass: "text-slate-950",
    subClass: "text-green-700",
  },
  {
    name: "USDC borrowed",
    value: "$1,100",
    sub: "4.1% APR",
    valueClass: "text-red-800",
    subClass: "text-yellow-900",
  },
];

const policies = [
  {
    icon: CircleDollarSign,
    title: "Max spend per tx",
    desc: "500 USDC limit",
    iconBox: "bg-blue-100 text-blue-700",
  },
  {
    icon: Filter,
    title: "Aave only",
    desc: "Other protocols blocked",
    iconBox: "bg-green-100 text-green-700",
  },
  {
    icon: Clock3,
    title: "Time-lock",
    desc: "Once per 30 minutes",
    iconBox: "bg-yellow-100 text-yellow-800",
  },
  {
    icon: Skull,
    title: "Auto-kill threshold",
    desc: "Trigger if health < 1.5",
    iconBox: "bg-red-100 text-red-800",
  },
];

const feed = [
  {
    dot: "bg-red-900",
    title: "Kill switch triggered � session revoked",
    tag: "killed",
    tagClass: "bg-red-100 text-red-800",
    time: "just now",
  },
  {
    dot: "bg-blue-600",
    title: "Agent scanned Aave positions",
    tag: "ok",
    tagClass: "bg-green-100 text-green-800",
    time: "2 min ago",
  },
  {
    dot: "bg-green-700",
    title: "Supplied 200 USDC to Aave",
    tag: "executed",
    tagClass: "bg-green-100 text-green-800",
    time: "8 min ago",
  },
  {
    dot: "bg-red-900",
    title: "Tried to send 800 USDC � exceeded limit",
    tag: "blocked",
    tagClass: "bg-red-100 text-red-800",
    time: "22 min ago",
  },
  {
    dot: "bg-red-900",
    title: "Tried unknown contract 0x9f2a...",
    tag: "blocked",
    tagClass: "bg-red-100 text-red-800",
    time: "1 hr ago",
  },
  {
    dot: "bg-green-700",
    title: "Withdrew 100 USDC from Aave",
    tag: "executed",
    tagClass: "bg-green-100 text-green-800",
    time: "2 hr ago",
  },
  {
    dot: "bg-blue-600",
    title: "Agent session started",
    tag: "session",
    tagClass: "bg-yellow-100 text-yellow-800",
    time: "3 hr ago",
  },
];

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className: string;
}) {
  return (
    <div className="rounded-[28px] bg-white px-7 py-6 shadow-[0_12px_50px_rgba(15,23,42,0.08)]">
      <p className="text-sm font-medium tracking-wide text-slate-500">{label}</p>
      <p className={`mt-4 text-[34px] font-semibold tracking-tight ${className}`}>{value}</p>
    </div>
  );
}

function App() {
  const [ensDomain, setEnsDomain] = useState("vitalik.eth");
  const [ensInput, setEnsInput] = useState("");
  const [showRAGPanel, setShowRAGPanel] = useState(false);
  const [ragQuery, setRagQuery] = useState("");
  const [ragResults, setRagResults] = useState<Array<{ title: string; content: string; source: string }>>([]);
  const [isLoadingRAG, setIsLoadingRAG] = useState(false);

  const handleENSResolve = () => {
    if (ensInput.trim()) {
      setEnsDomain(ensInput);
      setEnsInput("");
      // In production, this would call ENS resolution service
      // For now, we'll just update the display
    }
  };

  const handleRAGQuery = async () => {
    if (!ragQuery.trim()) return;

    setIsLoadingRAG(true);
    // Simulate RAG query - in production, this would call your backend
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const mockResults = [
      {
        title: "Aave Protocol Documentation",
        content:
          "Aave is a decentralized lending protocol that allows users to supply and borrow digital assets. The protocol uses a governance token (AAVE) and features risk management through collateral requirements.",
        source: "aave.com/docs",
      },
      {
        title: "USDC Smart Contract",
        content:
          "USDC is a fully collateralized US dollar stablecoin on multiple blockchains. Developed by Circle, it maintains a 1:1 reserve ratio with USD backing.",
        source: "circle.com/usdc",
      },
      {
        title: "Smart Contract Security Best Practices",
        content:
          "Always validate inputs, use established patterns, audit external calls, and maintain reentrancy guards in lending protocols.",
        source: "ethereum.org/security",
      },
    ];

    setRagResults(mockResults);
    setIsLoadingRAG(false);
  };

  return (
    <div className="min-h-screen bg-[#f7f5ee] text-slate-950">
      <header className="border-b border-slate-200 bg-[#fbfaf7] px-6 py-5 shadow-sm">
        <div className="mx-auto flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between xl:gap-0 max-w-[1420px]">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-3xl bg-blue-100 text-blue-600 shadow-sm">
              <ShieldCheck className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-500">One Agent</p>
              <h1 className="text-3xl font-bold tracking-tight text-slate-950">Agent policy dashboard</h1>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
              <div className="flex items-center gap-2 rounded-2xl border border-indigo-200 bg-white px-3 py-2 shadow-sm">
                <input
                  type="text"
                  placeholder="address or .eth"
                  value={ensInput}
                  onChange={(e) => setEnsInput(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleENSResolve()}
                  className="w-28 bg-transparent text-xs font-medium text-slate-950 placeholder-slate-400 outline-none"
                />
                <button
                  onClick={handleENSResolve}
                  className="text-xs font-semibold text-indigo-600 transition hover:text-indigo-700"
                >
                  Set
                </button>
              </div>
              <div className="flex items-center gap-2 rounded-3xl bg-slate-50 px-4 py-2 text-xs font-medium text-slate-700 shadow-sm">
                <span className="text-slate-500">ENS:</span>
                <span className="font-semibold text-slate-950">{ensDomain}</span>
              </div>
              <button
                onClick={() => setShowRAGPanel(!showRAGPanel)}
                className="flex items-center gap-2 rounded-3xl bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 shadow-sm"
              >
                <Search className="h-4 w-4" />
                RAG Query
              </button>
            </div>

            <div className="flex items-center gap-2 rounded-3xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm">
              <span className="h-2.5 w-2.5 rounded-full bg-red-900" />
              Agent stopped
            </div>
            <button className="rounded-3xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
              Kill switch
            </button>
            <button className="rounded-3xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
              0x3f4a...c92b
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1420px] px-6 py-8">
        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </section>

        <section className="mt-8 grid gap-8 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-8">
            <section className="rounded-[32px] border border-slate-200 bg-white px-8 py-8 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <Building2 className="h-6 w-6 text-slate-700" />
                  <div>
                    <h2 className="text-2xl font-semibold text-slate-950">Aave positions</h2>
                    <p className="text-sm text-slate-500">Current deposited, borrowed and health status.</p>
                  </div>
                </div>
                <div className="rounded-3xl bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                  Health factor 2.41
                </div>
              </div>

              <div className="space-y-4">
                {positions.map((position) => (
                  <div key={position.name} className="flex flex-col gap-2 rounded-[26px] border border-slate-200 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-lg font-semibold text-slate-950">{position.name}</p>
                      <p className="text-sm text-slate-500">{position.sub}</p>
                    </div>
                    <p className={`text-[24px] font-semibold ${position.valueClass}`}>{position.value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[32px] border border-slate-200 bg-white px-8 py-8 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
              <div className="mb-8 flex items-center gap-3">
                <ListChecks className="h-6 w-6 text-slate-700" />
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">Policy rules</h2>
                  <p className="text-sm text-slate-500">Guardrails that enforce safe agent behavior.</p>
                </div>
              </div>

              <div className="grid gap-4">
                {policies.map((policy) => {
                  const Icon = policy.icon;
                  return (
                    <div key={policy.title} className="flex items-center justify-between gap-4 rounded-[26px] border border-slate-200 bg-slate-50 px-5 py-4">
                      <div className="flex items-center gap-4">
                        <div className={`flex h-12 w-12 items-center justify-center rounded-3xl ${policy.iconBox}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-lg font-semibold text-slate-950">{policy.title}</p>
                          <p className="text-sm text-slate-500">{policy.desc}</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">Enabled</span>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <section className="rounded-[32px] border border-slate-200 bg-white px-8 py-8 shadow-[0_18px_60px_rgba(15,23,42,0.06)]">
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <Activity className="h-6 w-6 text-slate-700" />
                <div>
                  <h2 className="text-2xl font-semibold text-slate-950">Agent action feed</h2>
                  <p className="text-sm text-slate-500">Execution history, blocked requests and alerts.</p>
                </div>
              </div>
              <button className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100">
                Refresh
              </button>
            </div>

            <div className="space-y-4 max-h-[700px] overflow-y-auto pr-1">
              {feed.map((entry) => (
                <div key={entry.title} className="rounded-[26px] border border-slate-200 bg-slate-50 px-5 py-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3">
                      <span className={`mt-1 inline-flex h-3.5 w-3.5 rounded-full ${entry.dot}`} />
                      <div>
                        <p className="text-base font-semibold text-slate-950">{entry.title}</p>
                        <p className="mt-1 text-sm text-slate-500">{entry.time}</p>
                      </div>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-sm font-semibold ${entry.tagClass}`}>{entry.tag}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </section>
      </main>

      {/* RAG Query Panel */}
      {showRAGPanel && (
        <div className="fixed inset-0 z-50 flex items-end bg-black bg-opacity-50 sm:items-center sm:justify-center">
          <div className="w-full rounded-t-[32px] bg-white sm:rounded-[32px] sm:w-full sm:max-w-2xl shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-8 py-6">
              <div>
                <h2 className="text-2xl font-semibold text-slate-950">RAG Knowledge Query</h2>
                <p className="mt-1 text-sm text-slate-600">Ask about smart contracts, protocols, and blockchain security</p>
              </div>
              <button onClick={() => setShowRAGPanel(false)} className="text-slate-500 transition hover:text-slate-700">
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-6 px-8 py-6 max-h-[70vh] overflow-y-auto">
              {/* RAG Results */}
              {ragResults.length > 0 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-slate-950">Results</h3>
                  {ragResults.map((result, idx) => (
                    <div key={idx} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <h4 className="font-semibold text-slate-950">{result.title}</h4>
                          <p className="mt-2 text-sm text-slate-700">{result.content}</p>
                          <p className="mt-3 text-xs font-medium text-indigo-600">Source: {result.source}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Query Input */}
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Ask about protocols, contracts, or security best practices..."
                  value={ragQuery}
                  onChange={(e) => setRagQuery(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleRAGQuery()}
                  className="flex-1 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-950 placeholder-slate-400 transition focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                />
                <button
                  onClick={handleRAGQuery}
                  disabled={isLoadingRAG}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  {isLoadingRAG ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Loading
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      Query
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
