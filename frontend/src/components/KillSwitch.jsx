import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { VAULT_ADDRESS, VAULT_ABI } from "../wagmi";

const AGENT_URL = import.meta.env.VITE_AGENT_URL || "http://localhost:3001";

export default function KillSwitch() {
  const { isConnected } = useAccount();
  const [agentLog, setAgentLog] = useState([]);
  const [agentOnline, setAgentOnline] = useState(null);

  const { data: policy, isLoading, isError, refetch } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "getPolicy",
  });

  const { writeContract, isPending } = useWriteContract();

  const isRevoked = policy?.[1] ?? false;
  const latestAction = agentLog[0] ?? null;
  const status = useMemo(() => {
    if (!isConnected) {
      return {
        label: "Wallet disconnected",
        detail: "Connect a wallet to manage agent protection.",
        color: "bg-gray-400",
        pulse: false,
      };
    }

    if (isLoading) {
      return {
        label: "Checking vault",
        detail: "Reading the on-chain agent policy.",
        color: "bg-yellow-400",
        pulse: true,
      };
    }

    if (isError) {
      return {
        label: "Vault unavailable",
        detail: "Unable to read the on-chain policy status.",
        color: "bg-yellow-500",
        pulse: false,
      };
    }

    if (isRevoked) {
      return {
        label: "Agent revoked",
        detail: "The on-chain kill switch is blocking agent execution.",
        color: "bg-red-500",
        pulse: false,
      };
    }

    if (agentOnline === false) {
      return {
        label: "Agent backend offline",
        detail: "The wallet is connected, but the AI agent service is unreachable.",
        color: "bg-yellow-500",
        pulse: false,
      };
    }

    if (!latestAction) {
      return {
        label: "Agent idle",
        detail: "Wallet and vault are ready. No agent run has been recorded yet.",
        color: "bg-blue-500",
        pulse: false,
      };
    }

    if (latestAction.status === "blocked") {
      return {
        label: "Last action blocked",
        detail: latestAction.reason || "PolicyVault blocked the most recent agent action.",
        color: "bg-red-500",
        pulse: false,
      };
    }

    if (latestAction.status === "error") {
      return {
        label: "Agent error",
        detail: latestAction.reason || "The agent hit an error during its last run.",
        color: "bg-yellow-500",
        pulse: false,
      };
    }

    if (latestAction.decision?.action === "none") {
      return {
        label: "Agent monitoring",
        detail: latestAction.decision.reason || "The latest run chose not to submit a transaction.",
        color: "bg-green-500",
        pulse: true,
      };
    }

    return {
      label: "Agent executed",
      detail: latestAction.decision?.reason || "The latest agent action passed policy checks.",
      color: "bg-green-500",
      pulse: true,
    };
  }, [agentOnline, isConnected, isError, isLoading, isRevoked, latestAction]);

  async function fetchAgentLog() {
    const res = await fetch(`${AGENT_URL}/log`).catch(() => null);
    if (!res?.ok) {
      setAgentOnline(false);
      return;
    }

    setAgentOnline(true);
    setAgentLog(await res.json());
  }

  useEffect(() => {
    fetchAgentLog();
    const id = setInterval(fetchAgentLog, 5000);
    return () => clearInterval(id);
  }, []);

  function toggle() {
    writeContract({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: isRevoked ? "reinstateAgent" : "emergencyRevoke",
      args: [],
    }, { onSuccess: () => refetch() });
  }

  return (
    <div className="bg-white dark:bg-slate-900 rounded-xl p-5 flex flex-col items-center justify-center gap-4 border border-gray-200 dark:border-slate-700 shadow-sm">
      <p className="text-sm text-gray-500 dark:text-slate-400 font-semibold uppercase tracking-wider">Kill Switch</p>

      <div className={`w-4 h-4 rounded-full ${status.color} ${status.pulse ? "animate-pulse" : ""}`} />

      <div className="text-center space-y-1">
        <p className="text-xs font-semibold uppercase text-gray-500 dark:text-slate-300">{status.label}</p>
        <p className="text-xs text-gray-400 dark:text-slate-500">{status.detail}</p>
      </div>

      <button
        onClick={toggle}
        disabled={isPending || !isConnected || isLoading || isError}
        className={`w-full py-3 rounded-lg font-bold text-sm transition disabled:opacity-40 ${
          isRevoked
            ? "bg-green-600 hover:bg-green-500 text-white"
            : "bg-red-600 hover:bg-red-500 text-white"
        }`}
      >
        {isPending
          ? "Confirming…"
          : isRevoked
          ? "Reinstate Agent"
          : "Emergency Revoke"}
      </button>
    </div>
  );
}
