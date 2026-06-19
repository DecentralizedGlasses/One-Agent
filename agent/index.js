import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";
import { createPublicClient, createWalletClient, http, encodeFunctionData, parseAbi, maxUint256 } from "viem";
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
// Base Sepolia Aave V3 pool — matches the vault's deployed whitelist
const AAVE_POOL       = "0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27";
// USDC used by this specific Aave V3 pool on Base Sepolia (NOT Circle's bridged USDC)
const USDC            = "0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f";
// aUSDC — the receipt token minted by Aave when USDC is supplied; vault must hold this to withdraw
const A_USDC          = "0x10F1A9D11CDf50041f3f8cB7191CBE2f31750ACC";

// Spend cap demo: multiplier applied to the live maxTxAmount to guarantee the cap fires
const DEMO_EXCEED_MULTIPLIER = 2;

const account       = privateKeyToAccount(process.env.PRIVATE_KEY);
const transport     = http(process.env.BASE_SEPOLIA_RPC_URL);
const publicClient  = createPublicClient({ chain: baseSepolia, transport });
const walletClient  = createWalletClient({ account, chain: baseSepolia, transport });

// ── ABIs ──────────────────────────────────────────────────────────────────────
const VAULT_ABI = parseAbi([
  "function execute(address target, uint256 amount, bytes calldata callData) external returns (bytes memory)",
  "function setAllowedProtocols(address[] calldata protocols) external",
  "function getAllowedProtocols() external view returns (address[])",
  "function getPolicy() external view returns (address,bool,uint256,uint256,uint256,int256,uint256,address[])",
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

const ERC20_ABI = parseAbi([
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function approve(address spender, uint256 amount) external returns (bool)",
]);

// ── In-memory log ─────────────────────────────────────────────────────────────
const actionLog = [];
function logAction(entry) {
  actionLog.unshift({ ts: Date.now(), ...entry });
  if (actionLog.length > 100) actionLog.pop();
}

// ── Vault USDC / aUSDC balances ───────────────────────────────────────────────
async function getVaultBalances() {
  const [usdc, ausdc] = await Promise.all([
    publicClient.readContract({ address: USDC,   abi: ERC20_ABI, functionName: "balanceOf", args: [VAULT_ADDRESS] }),
    publicClient.readContract({ address: A_USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [VAULT_ADDRESS] }),
  ]);
  return { usdcRaw: usdc, ausdcRaw: ausdc };
}

// ── Aave position ─────────────────────────────────────────────────────────────
async function getPosition() {
  const [col, debt, borrows, , , hf] = await publicClient.readContract({
    address: AAVE_POOL, abi: AAVE_ABI,
    functionName: "getUserAccountData", args: [VAULT_ADDRESS],
  });
  const MAX = BigInt("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");
  return {
    totalCollateralUSD:  Number(col)     / 1e8,
    totalDebtUSD:        Number(debt)    / 1e8,
    availableBorrowsUSD: Number(borrows) / 1e8,
    healthFactor:        hf >= MAX ? null : Number(hf) / 1e18,
  };
}

// ── One-time vault setup ──────────────────────────────────────────────────────
// The deployer wallet is both owner and agent, so the agent can call owner-only
// functions like setAllowedProtocols to self-configure.
async function ensureSetup() {
  try {
    // 1. Ensure USDC is in the vault's protocol whitelist so the agent can
    //    call approve() on the USDC token through execute() before supplying.
    const protocols = await publicClient.readContract({
      address: VAULT_ADDRESS, abi: VAULT_ABI,
      functionName: "getAllowedProtocols",
    });

    const hasUsdc = protocols.some(p => p.toLowerCase() === USDC.toLowerCase());
    if (!hasUsdc) {
      console.log("[setup] Adding USDC to vault whitelist…");
      const aaveAlreadyIn = protocols.some(p => p.toLowerCase() === AAVE_POOL.toLowerCase());
      const newList = aaveAlreadyIn
        ? [...protocols, USDC]
        : [AAVE_POOL, USDC];
      const hash = await walletClient.writeContract({
        address: VAULT_ADDRESS, abi: VAULT_ABI,
        functionName: "setAllowedProtocols",
        args: [newList],
      });
      await publicClient.waitForTransactionReceipt({ hash, confirmations: 1 });
      console.log("[setup] USDC added to whitelist");
    }

    // 2. Ensure the vault has approved Aave pool to spend its USDC.
    //    Without this, supply() calls always fail with ERC-20 transfer errors.
    const allowance = await publicClient.readContract({
      address: USDC, abi: ERC20_ABI,
      functionName: "allowance",
      args: [VAULT_ADDRESS, AAVE_POOL],
    });

    if (allowance === 0n) {
      console.log("[setup] Approving Aave pool to spend vault's USDC…");
      const approveCallData = encodeFunctionData({
        abi: ERC20_ABI, functionName: "approve",
        args: [AAVE_POOL, maxUint256],
      });
      await walletClient.writeContract({
        address: VAULT_ADDRESS, abi: VAULT_ABI,
        functionName: "execute",
        args: [USDC, 0n, approveCallData],
      });
      console.log("[setup] USDC approved for Aave pool");
    }
  } catch (err) {
    // Non-fatal: vault may not be funded yet; setup can be retried on next run
    console.warn("[setup] Setup step skipped:", err.message?.slice(0, 120));
  }
}

// ── Claude: decide what the agent should do ───────────────────────────────────
async function askClaude(position, aggressive = false, maxTxAmount = null) {
  // Demo mode: always exceed the live on-chain spend cap to reliably trigger the firewall.
  if (aggressive) {
    const capUsdc = maxTxAmount ? Number(maxTxAmount) / 1e6 : 1000;
    const demoAmount = Math.ceil(capUsdc * DEMO_EXCEED_MULTIPLIER);
    return { action: "withdraw", amount: demoAmount, reason: `Aggressive rebalance — attempting to withdraw $${demoAmount} USDC to demonstrate the spend cap firewall.` };
  }

  if (!anthropic) {
    if (position.healthFactor !== null && position.healthFactor < 1.5) return { action: "supply", amount: 300, reason: "EMERGENCY: health factor critically low — supplying collateral to avoid liquidation." };
    if (position.healthFactor !== null && position.healthFactor < 1.8) return { action: "supply", amount: 150, reason: "Health factor below safe threshold — adding collateral." };
    return { action: "withdraw", amount: 150, reason: "Health factor strong — withdrawing 150 USDC to rebalance liquidity." };
  }



  const hfDisplay = position.healthFactor !== null ? position.healthFactor.toFixed(4) : "N/A";

  const prompt = position.healthFactor !== null && position.healthFactor < 1.5
    ? `You are an autonomous AI DeFi agent. This is an EMERGENCY.

Current Aave position:
- Collateral: $${position.totalCollateralUSD.toFixed(2)}
- Debt: $${position.totalDebtUSD.toFixed(2)}
- Health Factor: ${hfDisplay} ← CRITICALLY LOW (liquidation at 1.0)

The health factor is dangerously close to liquidation. You must immediately supply collateral to rescue the position before it gets liquidated.

Reply with JSON only: { "action": "supply", "amount": <number between 100-400>, "reason": "<urgent one-sentence explanation>" }`

    : `You are an autonomous AI DeFi agent managing an Aave v3 position on Base Sepolia.

Current position:
- Collateral: $${position.totalCollateralUSD.toFixed(2)}
- Debt: $${position.totalDebtUSD.toFixed(2)}
- Health Factor: ${hfDisplay}
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
async function submitAction(decision, aggressive = false) {
  if (decision.action === "none") return null;

  const amountRaw = BigInt(Math.floor((decision.amount ?? 0) * 1e6));

  // For the spend cap demo, pass the USDC amount as the vault's `amount` parameter
  // so the vault's spend cap check fires before the Aave call.
  // For regular runs, pass 0 — Aave's supply/withdraw are not payable functions and
  // will revert if any ETH value is forwarded (even a tiny amount in wei).
  const vaultAmount = aggressive ? amountRaw : 0n;

  // Supply: vault holds USDC and gets aUSDC back (onBehalfOf = vault so vault can later withdraw)
  // Withdraw: vault burns vault's aUSDC and sends underlying USDC to the owner wallet
  const callData = decision.action === "supply"
    ? encodeFunctionData({ abi: AAVE_ABI, functionName: "supply",   args: [USDC, amountRaw, VAULT_ADDRESS, 0] })
    : encodeFunctionData({ abi: AAVE_ABI, functionName: "withdraw", args: [USDC, amountRaw, FALLBACK_OWNER] });

  return walletClient.writeContract({
    address: VAULT_ADDRESS, abi: VAULT_ABI,
    functionName: "execute", args: [AAVE_POOL, vaultAmount, callData],
  });
}

// ── Parse vault revert → human reason ────────────────────────────────────────
function parseBlockReason(err, decision, maxTxAmount) {
  const amt      = decision?.amount ?? "?";
  const act      = decision?.action ?? "action";
  const errName  = err?.cause?.data?.errorName ?? err?.name ?? "";
  const errMsg   = err?.message ?? "";
  const capUsdc  = maxTxAmount ? Number(maxTxAmount) / 1e6 : "?";

  if (errName === "AmountExceedsLimit" || errMsg.includes("AmountExceedsLimit")) {
    return { rule: "SpendCap",     reason: `Agent tried to ${act} $${amt} USDC — exceeds your ${capUsdc} USDC per-transaction spend cap.` };
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
    return { rule: "CallFailed",   reason: `Aave call failed — vault needs USDC balance to ${act}. Fund the vault at ${VAULT_ADDRESS} with USDC on Base Sepolia.` };
  }
  return { rule: "PolicyVault",    reason: `Transaction blocked by PolicyVault (${errName || "unknown error"}).` };
}

// ── Main agent cycle ──────────────────────────────────────────────────────────
async function runCycle(aggressive = false) {
  let decision = null;
  let maxTxAmount = null;
  try {
    // Read live policy on every cycle so error messages reflect the current on-chain limit
    const [policy, position, vaultBal] = await Promise.all([
      publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "getPolicy" }),
      getPosition(),
      getVaultBalances(),
    ]);
    maxTxAmount = policy[2];
    const vaultUsdcUsdc  = Number(vaultBal.usdcRaw)  / 1e6; // vault USDC available to supply
    const vaultAusdcUsdc = Number(vaultBal.ausdcRaw) / 1e6; // vault aUSDC available to withdraw

    decision = await askClaude(position, aggressive, maxTxAmount);

    // Snapshot captured before any mutation — stored in every log entry
    const snapshot = {
      vaultUsdc:    vaultUsdcUsdc,
      vaultAusdc:   vaultAusdcUsdc,
      healthFactor: position.healthFactor,
      collateralUSD: position.totalCollateralUSD,
      debtUSD:       position.totalDebtUSD,
      maxTxUsdc:     Number(maxTxAmount) / 1e6,
      cooldownSec:   Number(policy[3]),
      isRevoked:     policy[1],
    };

    if (!decision.action || decision.action === "none") {
      const entry = { status: "idle", reason: "Agent scanned position — no action needed", decision, ...snapshot };
      logAction(entry);
      return entry;
    }

    // Cap the action to what the vault can actually execute.
    // Skip for demo (aggressive) mode — demo always hits the spend cap before reaching Aave.
    if (!aggressive && decision.action === "withdraw" && vaultAusdcUsdc < 1) {
      if (vaultUsdcUsdc >= 50) {
        // Vault has no aUSDC to withdraw; flip to supply instead so the vault builds a position
        decision = { action: "supply", amount: Math.min(decision.amount, vaultUsdcUsdc), reason: "Vault has no aUSDC to withdraw — supplying USDC to Aave first to build the vault's position." };
      } else {
        const entry = { status: "idle", reason: "Vault has no aUSDC to withdraw and no USDC to supply — fund the vault first.", decision, ...snapshot };
        logAction(entry);
        return entry;
      }
    } else if (!aggressive && decision.action === "withdraw") {
      // Cap withdrawal to what the vault actually holds
      decision = { ...decision, amount: Math.min(decision.amount, Math.floor(vaultAusdcUsdc)) };
    } else if (!aggressive && decision.action === "supply" && vaultUsdcUsdc < decision.amount) {
      if (vaultUsdcUsdc >= 50) {
        decision = { ...decision, amount: Math.floor(vaultUsdcUsdc), reason: decision.reason + ` (capped to vault's ${Math.floor(vaultUsdcUsdc)} USDC balance)` };
      } else {
        const entry = { status: "idle", reason: "Vault USDC balance too low to supply — fund the vault.", decision, ...snapshot };
        logAction(entry);
        return entry;
      }
    }

    const hash = await submitAction(decision, aggressive);
    const entry = { status: "allowed", decision, hash: hash ?? null, ...snapshot };
    logAction(entry);
    return entry;

  } catch (err) {
    const { rule, reason } = parseBlockReason(err, decision, maxTxAmount);
    const snapshot = {
      healthFactor:  null,
      collateralUSD: null,
      debtUSD:       null,
      maxTxUsdc:     maxTxAmount ? Number(maxTxAmount) / 1e6 : null,
    };
    const entry = { status: "blocked", rule, reason, decision, ...snapshot };
    logAction(entry);
    return entry;
  }
}

// ── Express API ───────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

app.get("/position",  async (req, res) => res.json(await getPosition().catch(e => ({ error: e.message }))));
app.get("/log",       (_, res) => res.json(actionLog));
app.post("/run",      async (req, res) => res.json(await runCycle(false)));
app.post("/run-demo", async (req, res) => res.json(await runCycle(true)));

// ── Vault info endpoint (for frontend diagnostics) ────────────────────────────
app.get("/vault-info", async (req, res) => {
  try {
    const [policy, usdcBalance, ausdcBalance, usdcAllowance] = await Promise.all([
      publicClient.readContract({ address: VAULT_ADDRESS, abi: VAULT_ABI, functionName: "getPolicy" }),
      publicClient.readContract({ address: USDC,   abi: ERC20_ABI, functionName: "balanceOf", args: [VAULT_ADDRESS] }),
      publicClient.readContract({ address: A_USDC, abi: ERC20_ABI, functionName: "balanceOf", args: [VAULT_ADDRESS] }),
      publicClient.readContract({ address: USDC,   abi: ERC20_ABI, functionName: "allowance", args: [VAULT_ADDRESS, AAVE_POOL] }),
    ]);
    res.json({
      vaultAddress:  VAULT_ADDRESS,
      usdcBalance:   Number(usdcBalance)  / 1e6,
      ausdcBalance:  Number(ausdcBalance) / 1e6,
      usdcApproved:  usdcAllowance > 0n,
      protocols:     policy[7],
      maxTxUsdc:     Number(policy[2]) / 1e6,
      cooldownSeconds: Number(policy[3]),
    });
  } catch (e) {
    res.json({ error: e.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`[agent] listening on :${PORT}`);
  // Run one-time vault setup after the server is ready
  ensureSetup().catch(e => console.warn("[setup] failed:", e.message?.slice(0, 80)));
});

// ── Background monitor ────────────────────────────────────────────────────────
// Checks position every 60s. If HF drops below 1.5, logs an alert in the
// action feed so the owner is notified.
let lastAlertTs = 0;

async function monitor() {
  try {
    const position = await getPosition();
    const hf = position.healthFactor;

    if (hf !== null && hf < 1.5) {
      const now = Date.now();
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

setInterval(monitor, 60_000);
