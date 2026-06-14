import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { createPublicClient, createWalletClient, http, encodeFunctionData, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import express from "express";
import cors from "cors";

const anthropic = process.env.ANTHROPIC_API_KEY
  ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  : null;

// ── Config ────────────────────────────────────────────────────────────────────
const VAULT_ADDRESS   = process.env.POLICY_VAULT_ADDRESS;
const FALLBACK_OWNER  = process.env.OWNER_ADDRESS;
// Base Sepolia Aave V3 pool — matches the vault whitelist deployed on Base Sepolia
const AAVE_POOL       = "0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27";
const USDC            = "0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f"; // USDC on this Base Sepolia Aave pool

const account       = privateKeyToAccount(process.env.PRIVATE_KEY);
const transport     = http(process.env.BASE_SEPOLIA_RPC_URL);
const publicClient  = createPublicClient({ chain: baseSepolia, transport });
const walletClient  = createWalletClient({ account, chain: baseSepolia, transport });

// ── ABIs ──────────────────────────────────────────────────────────────────────
const VAULT_ABI = parseAbi([
  "function execute(address target, uint256 amount, bytes calldata callData) external returns (bytes memory)",
  "error Revoked()",
  "error TargetNotAllowed(address target)",
  "error AmountExceedsLimit(uint256 requested, uint256 limit)",
  "error CooldownActive(uint256 availableAt, uint256 now_)",
  "error HealthFactorTooLow(uint256 current, uint256 floor)",
  "error PriceBelowFloor(int256 current, int256 floor)",
  "error CallFailed(bytes reason)",
  "error NotAgent()",
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
async function getPosition(userAddress) {
  const addr = userAddress || FALLBACK_OWNER;
  const [col, debt, borrows, , , hf] = await publicClient.readContract({
    address: AAVE_POOL, abi: AAVE_ABI,
    functionName: "getUserAccountData", args: [addr],
  });
  const MAX = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
  return {
    totalCollateralUSD:  Number(col)     / 1e8,
    totalDebtUSD:        Number(debt)    / 1e8,
    availableBorrowsUSD: Number(borrows) / 1e8,
    healthFactor:        hf >= MAX ? null : Number(hf) / 1e18,
  };
}

// ── Claude: decide what the agent should do ───────────────────────────────────
async function askClaude(position, aggressive = false) {
  if (!anthropic) {
    if (aggressive) return { action: "withdraw", amount: 750, reason: "Rebalancing portfolio — withdrawing 750 USDC to capture external yield opportunity." };
    if (position.healthFactor < 1.5) return { action: "supply", amount: 300, reason: "EMERGENCY: health factor critically low — supplying collateral to avoid liquidation." };
    if (position.healthFactor < 1.8) return { action: "supply", amount: 150, reason: "Health factor below safe threshold — adding collateral." };
    return { action: "withdraw", amount: 150, reason: "Health factor strong — withdrawing 150 USDC to rebalance liquidity." };
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
- If health factor >= 1.8: withdraw 100–200 USDC to optimize liquidity elsewhere.

Reply with JSON only: { "action": "supply"|"withdraw", "amount": <number>, "reason": "<one sentence explaining the decision>" }`;

  const resp = await anthropic.messages.create({
    model: "claude-sonnet-4-6", max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });
  const text = resp.content[0]?.text ?? "";
  // Claude sometimes returns multiple JSON blocks — take the last valid one with an action field
  const matches = [...text.matchAll(/\{[^{}]+\}/g)];
  for (const m of matches.reverse()) {
    try {
      const parsed = JSON.parse(m[0]);
      if (parsed.action) return parsed;
    } catch {}
  }
  return { action: "none", reason: "Could not parse Claude response." };
}

// ── Execute decision through PolicyVault ──────────────────────────────────────
async function submitAction(decision, userAddress) {
  if (decision.action === "none") return null;

  const onBehalfOf = userAddress || FALLBACK_OWNER;
  const amountRaw  = BigInt(Math.floor((decision.amount ?? 0) * 1e6));
  const callData   = decision.action === "supply"
    ? encodeFunctionData({ abi: AAVE_ABI, functionName: "supply",   args: [USDC, amountRaw, onBehalfOf, 0] })
    : encodeFunctionData({ abi: AAVE_ABI, functionName: "withdraw", args: [USDC, amountRaw, onBehalfOf] });
  const target = AAVE_POOL;

  return walletClient.writeContract({
    address: VAULT_ADDRESS, abi: VAULT_ABI,
    functionName: "execute", args: [target, amountRaw, callData],
  });
}

// ── Parse vault revert → human reason ────────────────────────────────────────
function parseBlockReason(err, decision) {
  const amt      = decision?.amount ?? "?";
  const act      = decision?.action ?? "action";
  const errName  = err?.cause?.data?.errorName ?? err?.name ?? "";
  const errMsg   = err?.message ?? "";

  if (errName === "AmountExceedsLimit" || errMsg.includes("AmountExceedsLimit")) {
    return { rule: "SpendCap",     reason: `Agent tried to ${act} $${amt} USDC — exceeds your ${500} USDC per-transaction spend cap.` };
  }
  if (errName === "Revoked" || errMsg.includes("Revoked")) {
    return { rule: "KillSwitch",   reason: "Agent is emergency-revoked. All transactions blocked until reinstated." };
  }
  if (errName === "CooldownActive" || errMsg.includes("CooldownActive")) {
    return { rule: "Cooldown",     reason: "Cooldown period is still active — too soon since the last transaction." };
  }
  if (errName === "TargetNotAllowed" || errMsg.includes("TargetNotAllowed")) {
    return { rule: "Whitelist",    reason: "Target contract is not on the protocol whitelist." };
  }
  if (errName === "HealthFactorTooLow" || errMsg.includes("HealthFactorTooLow")) {
    return { rule: "HealthFactor", reason: "Transaction blocked — health factor would drop below the policy floor." };
  }
  if (errName === "PriceBelowFloor" || errMsg.includes("PriceBelowFloor")) {
    return { rule: "PriceFloor",   reason: "ETH price is below your Chainlink price floor — no selling allowed." };
  }
  if (errName === "CallFailed" || errMsg.includes("CallFailed")) {
    return { rule: "CallFailed",   reason: `Aave call failed — vault may need USDC balance to ${act}.` };
  }
  return { rule: "PolicyVault",    reason: `Transaction blocked by PolicyVault (${errName || "unknown error"}).` };
}

// ── Main agent cycle ──────────────────────────────────────────────────────────
async function runCycle(aggressive = false, userAddress = null) {
  let decision = null;
  try {
    const position = await getPosition(userAddress);
    decision = await askClaude(position, aggressive);

    if (!decision.action || decision.action === "none") {
      const entry = { status: "idle", reason: "Agent scanned position — no action needed", decision };
      logAction(entry);
      return entry;
    }

    const hash = await submitAction(decision, userAddress);
    const entry = { status: "allowed", decision, hash: hash ?? null };
    logAction(entry);
    return entry;

  } catch (err) {
    const { rule, reason } = parseBlockReason(err, decision);
    const entry = { status: "blocked", rule, reason, decision };
    logAction(entry);
    return entry;
  }
}

// ── Express API ───────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

app.get("/position",  async (req, res) => res.json(await getPosition(req.query.address).catch(e => ({ error: e.message }))));
app.get("/log",       (_, res) => res.json(actionLog));
app.post("/run",      async (req, res) => res.json(await runCycle(false, req.body?.address)));
app.post("/run-demo", async (req, res) => res.json(await runCycle(true,  req.body?.address)));

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`[agent] listening on :${PORT}`));

// ── Background monitor ────────────────────────────────────────────────────────
// Checks position every 60s. If HF drops below 1.5, logs an alert in the
// action feed so the owner is notified. Does NOT attempt a supply transaction
// because the vault has no USDC to supply — that would silently fail on-chain.
let lastAlertTs = 0;

async function monitor() {
  try {
    const position = await getPosition(FALLBACK_OWNER);
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
