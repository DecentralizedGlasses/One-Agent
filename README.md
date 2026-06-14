# One-Agent

An on-chain policy firewall for AI-powered DeFi agents. One-Agent sits between an AI agent and a crypto wallet, enforcing user-defined rules that the agent cannot bypass — no matter what it decides.

## What it does

AI agents are increasingly managing DeFi positions autonomously. One-Agent gives users a trust layer: a smart contract that enforces hard rules on every transaction the agent tries to submit.

Every agent action goes through the `PolicyVault` contract first. If any rule is violated, the transaction reverts on-chain — the agent cannot override it.

**Six enforced rules:**

| Rule | What it checks |
|------|---------------|
| Kill switch | Owner can instantly revoke agent access |
| Protocol whitelist | Agent can only call approved contract addresses |
| Spend cap | Max USDC per transaction (e.g. 500 USDC) |
| Cooldown | Minimum time between actions (e.g. 30 minutes) |
| Aave health factor | Blocks actions if position health drops below floor |
| Chainlink price floor | Blocks actions if ETH price drops below minimum |

## Architecture

```
User Dashboard (React + wagmi)
        │
        ▼
PolicyVault.sol  ◄──── AI Agent (Node.js + Claude API)
        │
        ▼
   Aave v3 / DeFi Protocols
```

- **Smart contract** — `src/PolicyVault.sol` — Solidity 0.8.20, deployed on Ethereum Sepolia
- **Agent backend** — `agent/index.js` — Express server, calls Claude API, submits actions through the vault
- **Dashboard** — `frontend/` — React + Vite + Tailwind + wagmi, reads live on-chain state

## Deployed Contract

| Network | Address |
|---------|---------|
| Ethereum Sepolia | `0xBD54dEDEb7456552516CB7CE43a6e5F00df5Ea89` |

---

## Running Locally

### Prerequisites

- [Foundry](https://getfoundry.sh) — `curl -L https://foundry.paradigm.xyz | bash`
- [Node.js](https://nodejs.org) v18+
- MetaMask with Ethereum Sepolia and Base Sepolia networks added

### Step 1 — Clone

```bash
git clone https://github.com/DecentralizedGlasses/One-Agent.git
cd One-Agent
```

### Step 2 — Root `.env`

Create a `.env` file in the project root:

```env
# Owner wallet private key (the wallet that deploys the vault)
PRIVATE_KEY=0xYOUR_OWNER_PRIVATE_KEY

# Agent wallet address (a separate wallet the vault will authorize)
AGENT_ADDRESS=0xYOUR_AGENT_WALLET_ADDRESS

# Owner wallet address
OWNER_ADDRESS=0xYOUR_OWNER_WALLET_ADDRESS

# Anthropic API key — leave empty to run in mock mode (no key needed for demo)
ANTHROPIC_API_KEY=sk-ant-...

# Alchemy RPC URLs
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
RPC_URL=http://127.0.0.1:8545

# Deployed vault address (fill in after deploying)
POLICY_VAULT_ADDRESS=0xYOUR_VAULT_ADDRESS
```

### Step 3 — Frontend `.env`

Create a `frontend/.env` file:

```env
# Deployed vault contract address
VITE_VAULT_ADDRESS=0xYOUR_VAULT_ADDRESS

# Agent backend URL (local)
VITE_AGENT_URL=http://localhost:3001

# Alchemy RPC URLs (same keys as root .env)
VITE_SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
VITE_BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY
```

> Get a free Alchemy key at [alchemy.com](https://alchemy.com).

### Step 4 — Install dependencies

```bash
# Smart contract dependencies
forge install

# Agent backend
cd agent && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..
```

### Step 5 — Deploy the vault

**Option A — Local Anvil (no real ETH needed):**

```bash
# Terminal 1: start local chain
make anvil

# Terminal 2: deploy
make deploy-local
```

**Option B — Ethereum Sepolia (real testnet):**

```bash
make deploy-sepolia
```

Copy the printed vault address into both `.env` files as `POLICY_VAULT_ADDRESS` and `VITE_VAULT_ADDRESS`.

### Step 6 — Start the agent backend

```bash
cd agent && npm start
```

The agent listens on `http://localhost:3001`. If `ANTHROPIC_API_KEY` is empty it runs in mock mode — simulating decisions based on health factor, no API key required.

### Step 7 — Start the frontend

```bash
cd frontend && npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and connect MetaMask.

For local Anvil, add this network to MetaMask:
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`

Then import the Anvil owner key (dev only — never use on mainnet):
```
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

---

## Deploying to Production

The frontend and agent backend are deployed separately — the frontend goes to Vercel, the agent to Railway.

### Frontend → Vercel

1. Go to [vercel.com](https://vercel.com) → New Project → import this repo
2. Vercel auto-detects `vercel.json` — no build settings changes needed
3. Add these **Environment Variables** before deploying:

| Variable | Value |
|---|---|
| `VITE_VAULT_ADDRESS` | `0xBD54dEDEb7456552516CB7CE43a6e5F00df5Ea89` |
| `VITE_SEPOLIA_RPC_URL` | `https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY` |
| `VITE_BASE_SEPOLIA_RPC_URL` | `https://base-sepolia.g.alchemy.com/v2/YOUR_KEY` |
| `VITE_AGENT_URL` | your Railway agent URL (add after deploying agent) |

4. Click Deploy → your site is live

### Agent Backend → Railway

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub repo
2. Select this repo → set **Root Directory** to `agent`
3. Add these **Environment Variables** in Railway:

| Variable | Value |
|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` |
| `PRIVATE_KEY` | agent wallet private key |
| `POLICY_VAULT_ADDRESS` | `0xBD54dEDEb7456552516CB7CE43a6e5F00df5Ea89` |
| `OWNER_ADDRESS` | your owner wallet address |
| `BASE_SEPOLIA_RPC_URL` | `https://base-sepolia.g.alchemy.com/v2/YOUR_KEY` |
| `RPC_URL` | `https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY` |

4. Deploy → go to **Settings → Networking → Generate Domain** to get your public URL
5. Add that URL as `VITE_AGENT_URL` in Vercel → Redeploy

### Vercel — disable login protection

By default Vercel may require visitors to log in. To make the site public:

Settings → **Deployment Protection** → disable or set to **No Protection**

---

## Makefile reference

```
make build                  Build contracts
make test                   Run all 25 tests
make test-rule1             Kill switch tests
make test-rule2             Whitelist tests
make test-rule3             Spend cap tests
make test-rule4             Cooldown tests
make test-rule5             Health factor tests
make test-rule6             Chainlink price tests

make anvil                  Start local Anvil chain
make deploy-local           Deploy to Anvil
make deploy-sepolia         Deploy to Ethereum Sepolia
make deploy-sepolia-verify  Deploy + verify on Etherscan

make agent-dev              Start agent backend (watch mode)
make frontend-dev           Start frontend dev server
```

## Sponsor integrations

- **Chainlink** — ETH/USD price feed (`0x694AA1769357215DE4FAC081bf1f309aDC325306`) enforced as Rule 6 on every agent action. See [`src/PolicyVault.sol#L226`](src/PolicyVault.sol)
- **Aave v3** — health factor read from live position as Rule 5 (Base Sepolia pool `0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27`)

## License

MIT
