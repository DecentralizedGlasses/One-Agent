export default function StatsRow({ position, log }) {
  const today = new Date().setHours(0, 0, 0, 0);
  const todayLog       = log.filter(e => e.ts >= today);
  const actionsToday   = todayLog.length;
  const blockedToday   = todayLog.filter(e => e.status === "blocked").length;

  const hf    = position?.healthFactor ?? null;
  const hfStr = hf !== null ? hf.toFixed(2) : "—";
  const hfColor = hf === null ? "text-gray-400" : hf >= 2 ? "text-green-700" : hf >= 1.5 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        label="Total supplied"
        value={position ? `$${position.totalCollateralUSD.toLocaleString("en-US", { maximumFractionDigits: 0 })}` : "—"}
        valueClass="text-blue-600"
      />
      <StatCard
        label="Health factor"
        value={hfStr}
        valueClass={hfColor}
      />
      <StatCard label="Actions today"   value={actionsToday} />
      <StatCard label="Blocked attempts" value={blockedToday} valueClass={blockedToday > 0 ? "text-red-600" : "text-gray-900"} />
    </div>
  );
}

function StatCard({ label, value, valueClass = "text-gray-900" }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 px-5 py-4">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${valueClass}`}>{value}</p>
    </div>
  );
}
