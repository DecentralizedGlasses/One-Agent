import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { createPublicClient, createWalletClient, http, encodeFunctionData, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";
import express from "express";
import cors from "cors";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// ── Config ────────────────────────────────────────────────────────────────────
const VAULT_ADDRESS = process.env.POLICY_VAULT_ADDRESS;
const OWNER_ADDRESS = process.env.OWNER_ADDRESS;
// Ethereum Sepolia Aave V3 pool — must match what the vault's whitelist was deployed with
const AAVE_POOL     = "0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951";
const USDC          = "0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8"; // Aave testnet USDC on Sepolia

const account          = privateKeyToAccount(process.env.PRIVATE_KEY);
const sepoliaTransport = http(process.env.RPC_URL || "https://rpc.sepolia.org");
const publicClient     = createPublicClient({ chain: sepolia, transport: sepoliaTransport });
const walletClient     = createWalletClient({ account, chain: sepolia, transport: sepoliaTransport });

// ── ABIs ──────────────────────────────────────────────────────────────────────
const VAULT_ABI = parseAbi([
  "function execute(address target, uint256 amount, bytes calldata callData) external returns (bytes memory)",
]);

const AAVE_ABI = parseAbi([
  "function getUserAccountData(address) external view returns (uint256,uint256,uint256,uint256,uint256,uint256)",
  "function supply(address,uint256,address,uint16) external",
  "function withdraw(address,uint256,address) external returns (uint256)",
]);

// ── In-memory log ─────────────────────────────────────────────────────────────
const actionLog = [];
function logAction(entry) {
  actionLog.unshift({ ts: Date.now(), ...entry });
  if (actionLog.length > 100) actionLog.pop();
}

// ── Aave position ─────────────────────────────────────────────────────────────
const IS_LOCAL = (process.env.RPC_URL || "").includes("127.0.0.1") ||
                 (process.env.RPC_URL || "").includes("localhost");

async function getPosition() {
  if (IS_LOCAL) {
    return { totalCollateralUSD: 5000, totalDebtUSD: 2000,
             availableBorrowsUSD: 1500, healthFactor: 2.1, _mock: true };
  }
  const [col, debt, borrows, , , hf] = await publicClient.readContract({
    address: AAVE_POOL, abi: AAVE_ABI,
    functionName: "getUserAccountData", args: [OWNER_ADDRESS],
  });
  return {
    totalCollateralUSD:  Number(col)     / 1e8,
    totalDebtUSD:        Number(debt)    / 1e8,
    availableBorrowsUSD: Number(borrows) / 1e8,
    healthFactor:        Number(hf)      / 1e18,
  };
}

// ── Claude: decide what the agent should do ───────────────────────────────────
async function askClaude(position, aggressive = false) {
  if (!anthropic) {
    if (aggressive) return { action: "withdraw", amount: 750, reason: "Rebalancing portfolio — withdrawing 750 USDC to capture external yield opportunity." };
    if (position.healthFactor < 1.5) return { action: "supply", amount: 300, reason: "EMERGENCY: health factor critically low — supplying collateral to avoid liquidation." };
    if (position.healthFactor < 1.8) return { action: "supply", amount: 150, reason: "Health factor below safe threshold — adding collateral." };
    return { action: "withdraw", amount: 300, reason: "Health factor strong — withdrawing 300 USDC to rebalance liquidity." };
  }

  const prompt = aggressive
    ? `You are an autonomous AI DeFi agent. The portfolio is healthy and you decide to rebalance aggressively.

Current Aave position:
- Collateral: $${position.totalCollateralUSD.toFixed(2)}
- Debt: $${position.totalDebtUSD.toFixed(2)}
- Health Factor: ${position.healthFactor.toFixed(4)}

You want to withdraw USDC from Aave to capture a yield opportunity elsewhere. Choose an amount between 600 and 900 USDC.

Reply with JSON only: { "action": "withdraw", "amount": <number between 600-900>, "reason": "<your investment reasoning in one sentence>" }`

    : position.healthFactor < 1.5
    ? `You are an autonomous AI DeFi agent. This is an EMERGENCY.

Current Aave position:
- Collateral: $${position.totalCollateralUSD.toFixed(2)}
- Debt: $${position.totalDebtUSD.toFixed(2)}
- Health Factor: ${position.healthFactor.toFixed(4)} ← CRITICALLY LOW (liquidation at 1.0)

The health factor is dangerously close to liquidation. You must immediately supply collateral to rescue the position before it gets liquidated.

Reply with JSON only: { "action": "supply", "amount": <number between 100-400>, "reason": "<urgent one-sentence explanation>" }`

    : `You are an autonomous AI DeFi agent managing an Aave v3 position on Base Sepolia.

Current position:
- Collateral: $${position.totalCollateralUSD.toFixed(2)}
- Debt: $${position.totalDebtUSD.toFixed(2)}
- Health Factor: ${position.healthFactor.toFixed(4)}
- Available to borrow: $${position.availableBorrowsUSD.toFixed(2)}

Your job is to actively manage this portfolio. You must always take an action — either supply more collateral or withdraw some USDC to rebalance.

Rules (enforced on-chain by PolicyVault — not your concern):
- If health factor < 1.8: supply 100–300 USDC as collateral to stay safe.
- If health factor >= 1.8: withdraw 200–400 USDC to optimize liquidity elsewhere.

Reply with JSON only: { "action": "supply"|"withdraw", "amount": <number>, "reason": "<one sentence explaining the decision>" }`;

  const resp  = await anthropic.messages.create({
    model: "claude-sonnet-4-6", max_tokens: 200,
    messages: [{ role: "user", content: prompt }],
  });
  const text  = resp.content[0]?.text ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : { action: "none", reason: "Could not parse Claude response." };
}

// ── Execute decision through PolicyVault ──────────────────────────────────────
async function submitAction(decision) {
  if (decision.action === "none") return null;

  const target    = IS_LOCAL ? "0x0000000000000000000000000000000000000001" : AAVE_POOL;
  const amountRaw = BigInt(Math.floor((decision.amount ?? 0) * 1e6));

  const callData = IS_LOCAL
    ? "0x"
    : decision.action === "supply"
      ? encodeFunctionData({ abi: AAVE_ABI, functionName: "supply",   args: [USDC, amountRaw, OWNER_ADDRESS, 0] })
      : encodeFunctionData({ abi: AAVE_ABI, functionName: "withdraw", args: [USDC, amountRaw, OWNER_ADDRESS] });

  return walletClient.writeContract({
    address: VAULT_ADDRESS, abi: VAULT_ABI,
    functionName: "execute", args: [target, amountRaw, callData],
  });
}

// ── Parse vault revert → human reason ────────────────────────────────────────
function parseBlockReason(errMsg, decision) {
  const amt = decision?.amount ?? "?";
  const act = decision?.action ?? "action";
  if (errMsg?.includes("AmountExceedsLimit")) {
    return { rule: "SpendCap",    reason: `Agent tried to ${act} $${amt} USDC but it exceeds your per-transaction spend cap.` };
  }
  if (errMsg?.includes("Revoked")) {
    return { rule: "KillSwitch",  reason: "Agent has been emergency-revoked by the owner. All transactions are blocked." };
  }
  if (errMsg?.includes("CooldownActive")) {
    return { rule: "Cooldown",    reason: "A transaction was made recently. The cooldown period is still active." };
  }
  if (errMsg?.includes("TargetNotAllowed")) {
    return { rule: "Whitelist",   reason: "The target contract is not on the protocol whitelist." };
  }
  if (errMsg?.includes("HealthFactorTooLow")) {
    return { rule: "HealthFactor",reason: "Transaction blocked — health factor would drop below the policy floor." };
  }
  return { rule: "PolicyVault",   reason: `Transaction blocked by PolicyVault.` };
}

// ── Main agent cycle ──────────────────────────────────────────────────────────
async function runCycle(aggressive = false) {
  let decision = null;
  try {
    const position = await getPosition();
    decision = await askClaude(position, aggressive);

    if (!decision.action || decision.action === "none") {
      const entry = { status: "idle", reason: "Agent scanned position — no action needed", decision };
      logAction(entry);
      return entry;
    }

    const hash = await submitAction(decision);
    const entry = { status: "allowed", decision, hash: hash ?? null };
    logAction(entry);
    return entry;

  } catch (err) {
    const { rule, reason } = parseBlockReason(err.message, decision);
    const entry = { status: "blocked", rule, reason, decision };
    logAction(entry);
    return entry;
  }
}

// ── Express API ───────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

app.get("/position",  async (_, res) => res.json(await getPosition().catch(e => ({ error: e.message }))));
app.get("/log",       (_, res) => res.json(actionLog));
app.post("/run",      async (_, res) => res.json(await runCycle(false)));
app.post("/run-demo", async (_, res) => res.json(await runCycle(true)));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`[agent] listening on :${PORT}`));

// ── Background monitor ────────────────────────────────────────────────────────
// Checks position every 60s. If HF drops below 1.5, logs an alert in the
// action feed so the owner is notified. Does NOT attempt a supply transaction
// because the vault has no USDC to supply — that would silently fail on-chain.
let lastAlertTs = 0;

async function monitor() {
  try {
    const position = await getPosition();
    const hf = position.healthFactor;

    if (hf < 1.5) {
      const now = Date.now();
      // Alert at most once every 2 minutes to avoid flooding the feed
      if (now - lastAlertTs > 120_000) {
        lastAlertTs = now;
        console.log(`[monitor] ALERT — HF ${hf.toFixed(4)} below threshold`);
        logAction({
          status: "alert",
          rule: "HealthFactor",
          reason: `Health factor dropped to ${hf.toFixed(4)} — below the safety threshold. Immediate owner action required to add collateral or reduce debt before liquidation.`,
          decision: { action: "alert", healthFactor: hf },
        });
      }
    }
  } catch (err) {
    console.error("[monitor] error:", err.message);
  }
}

setInterval(monitor, 60_000); // check every 60 seconds
