import "dotenv/config";
import { createPublicClient, createWalletClient, http, encodeFunctionData, parseAbi } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import express from "express";
import cors from "cors";

// ── Config ────────────────────────────────────────────────────────────────────
const VAULT_ADDRESS  = process.env.POLICY_VAULT_ADDRESS;
const OWNER_ADDRESS  = process.env.OWNER_ADDRESS;
const AAVE_POOL      = "0x07eA79F68B2B3df564D0A34F8e19D9B1e339814"; // Base Sepolia
const USDC           = "0x036CbD53842c5426634e7929541eC2318f3dCF7e"; // Base Sepolia
const GEMINI_MODEL   = process.env.GEMINI_MODEL || "gemini-2.0-flash";

const account      = privateKeyToAccount(process.env.PRIVATE_KEY);
const transport    = http(process.env.RPC_URL || "https://sepolia.base.org");
const publicClient = createPublicClient({ chain: baseSepolia, transport });
const walletClient = createWalletClient({ account, chain: baseSepolia, transport });

// ── ABIs ──────────────────────────────────────────────────────────────────────
const VAULT_ABI = parseAbi([
  "function execute(address target, uint256 amount, bytes calldata callData) external returns (bytes memory)",
  "function getPolicy() external view returns (address, bool, uint256, uint256, uint256, uint256, address[])",
  "function cooldownRemaining() external view returns (uint256)",
  "function getHealthFactor() external view returns (uint256)",
  "function isRevoked() external view returns (bool)",
]);

const AAVE_ABI = parseAbi([
  "function getUserAccountData(address) external view returns (uint256,uint256,uint256,uint256,uint256,uint256)",
  "function supply(address,uint256,address,uint16) external",
  "function withdraw(address,uint256,address) external returns (uint256)",
]);

// ── In-memory action log (dashboard feed) ─────────────────────────────────────
const actionLog = [];

function logAction(entry) {
  actionLog.unshift({ ts: Date.now(), ...entry });
  if (actionLog.length > 100) actionLog.pop();
}

// ── Read Aave position ────────────────────────────────────────────────────────
const IS_LOCAL = (process.env.RPC_URL || "").includes("127.0.0.1") ||
                 (process.env.RPC_URL || "").includes("localhost");

async function getPosition() {
  // On local Anvil, Aave doesn't exist — return a realistic mock position
  if (IS_LOCAL) {
    return {
      totalCollateralUSD:  5000,
      totalDebtUSD:        2000,
      availableBorrowsUSD: 1500,
      healthFactor:        2.1,
      _mock: true,
    };
  }
  const [collateral, debt, borrows, , , hf] = await publicClient.readContract({
    address: AAVE_POOL, abi: AAVE_ABI,
    functionName: "getUserAccountData", args: [OWNER_ADDRESS],
  });
  return {
    totalCollateralUSD:  Number(collateral) / 1e8,
    totalDebtUSD:        Number(debt)       / 1e8,
    availableBorrowsUSD: Number(borrows)    / 1e8,
    healthFactor:        Number(hf)         / 1e18,
  };
}

// Ask Gemini what to do (or use mock if no API key)
async function askGemini(position) {
  // Mock mode: if no API key, simulate a Gemini decision based on health factor
  if (!process.env.GEMINI_API_KEY) {
    console.log("[agent] No API key — using mock decision");
    if (position.healthFactor < 1.8) {
      return { action: "supply", amount: 200, reason: "Health factor low — supplying 200 USDC to improve position" };
    }
    return { action: "none", reason: "Position is healthy — no action needed" };
  }

  const prompt = `You are an AI DeFi agent managing an Aave v3 position on Base Sepolia.

Current position:
- Collateral: $${position.totalCollateralUSD.toFixed(2)}
- Debt:       $${position.totalDebtUSD.toFixed(2)}
- Health factor: ${position.healthFactor.toFixed(4)}

Rules (enforced by on-chain PolicyVault — not your job to check):
- Max 500 USDC per transaction
- Only Aave protocol allowed
- 30-minute cooldown between actions
- Auto-blocked if health factor < 1.5

Respond with JSON only: { "action": "supply" | "withdraw" | "none", "amount": <USDC>, "reason": "<one sentence>" }`;

  const modelPath = GEMINI_MODEL.startsWith("models/") ? GEMINI_MODEL : `models/${GEMINI_MODEL}`;
  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/${modelPath}:generateContent?key=${process.env.GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: {
        maxOutputTokens: 256,
        responseMimeType: "application/json",
      },
    }),
  });

  const body = await resp.json();
  if (!resp.ok) {
    throw new Error(body.error?.message || `Gemini request failed with status ${resp.status}`);
  }

  const text = body.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  const match = text.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : { action: "none", reason: "Gemini parse error" };
}

// ── Submit action through PolicyVault ────────────────────────────────────────
async function submitAction(decision) {
  if (decision.action === "none") return null;

  // Local Anvil: vault's whitelisted target is 0x1 (dummy), Aave doesn't exist.
  // Simulate the tx going through PolicyVault using the dummy target so the
  // firewall rules (amount, cooldown, kill-switch) are still exercised.
  const target = IS_LOCAL ? "0x0000000000000000000000000000000000000001" : AAVE_POOL;

  const amountRaw = BigInt(Math.floor((decision.amount ?? 0) * 1e6));

  const callData = IS_LOCAL
    ? "0x"
    : decision.action === "supply"
      ? encodeFunctionData({ abi: AAVE_ABI, functionName: "supply",   args: [USDC, amountRaw, OWNER_ADDRESS, 0] })
      : encodeFunctionData({ abi: AAVE_ABI, functionName: "withdraw", args: [USDC, amountRaw, OWNER_ADDRESS] });

  const hash = await walletClient.writeContract({
    address: VAULT_ADDRESS, abi: VAULT_ABI,
    functionName: "execute", args: [target, 0n, callData],
  });
  return hash;
}

// ── Main decision cycle ───────────────────────────────────────────────────────
async function runCycle() {
  try {
    const position = await getPosition();
    const decision = await askGemini(position);
    const hash     = await submitAction(decision);

    const entry = { status: "allowed", position, decision, hash: hash ?? null };
    logAction(entry);
    return entry;
  } catch (err) {
    // Distinguish PolicyVault reverts (blocked) from network errors
    const blocked = err.message?.includes("revert") || err.message?.includes("Revoked");
    const entry   = { status: blocked ? "blocked" : "error", reason: err.message };
    logAction(entry);
    return entry;
  }
}

// ── Demo: forced violation (shows firewall working) ───────────────────────────
async function runViolation() {
  try {
    // Attempt to send to a non-whitelisted address — will revert with TargetNotAllowed
    const fakeTarget = "0x000000000000000000000000000000000000dEaD";
    await walletClient.writeContract({
      address: VAULT_ADDRESS, abi: VAULT_ABI,
      functionName: "execute", args: [fakeTarget, 0n, "0x"],
    });
  } catch (err) {
    logAction({ status: "blocked", reason: "TargetNotAllowed — demo violation", decision: { action: "send-to-blacklist" } });
    return { blocked: true, reason: err.message };
  }
}

// ── Express API ───────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

app.get("/position",  async (_, res) => res.json(await getPosition().catch(e => ({ error: e.message }))));
app.get("/log",       (_, res) => res.json(actionLog));
app.post("/run",      async (_, res) => res.json(await runCycle()));
app.post("/violate",  async (_, res) => res.json(await runViolation()));

app.listen(3001, () => console.log("[agent] listening on :3001"));
