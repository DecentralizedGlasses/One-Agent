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

## Prerequisites

- [Foundry](https://getfoundry.sh) — `curl -L https://foundry.paradigm.xyz | bash`
- [Node.js](https://nodejs.org) v18+
- MetaMask with Ethereum Sepolia network added

## Running locally

### 1. Clone and install

```bash
git clone https://github.com/DecentralizedGlasses/One-Agent.git
cd One-Agent
```

### 2. Set up environment variables

Create a `.env` file in the root:

```env
PRIVATE_KEY=0xYOUR_WALLET_PRIVATE_KEY      # owner wallet
AGENT_ADDRESS=0xYOUR_AGENT_WALLET_ADDRESS   # agent wallet (separate)
ANTHROPIC_API_KEY=                          # optional — uses mock mode if empty
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/YOUR_KEY
RPC_URL=http://127.0.0.1:8545              # local Anvil
```

Create `frontend/.env`:

```env
VITE_VAULT_ADDRESS=0xYOUR_VAULT_ADDRESS
VITE_AGENT_URL=http://localhost:3001
```

### 3. Install contract dependencies

```bash
forge install
```

### 4. Run tests

```bash
make test
```

All 25 tests should pass.

### 5. Start a local chain

```bash
make anvil
```

### 6. Deploy locally

In a new terminal:

```bash
make deploy-local
```

Copy the printed vault address into `frontend/.env` as `VITE_VAULT_ADDRESS`.

### 7. Start the agent backend

```bash
cd agent && npm install
POLICY_VAULT_ADDRESS=0xYOUR_VAULT_ADDRESS \
OWNER_ADDRESS=0xYOUR_OWNER_ADDRESS \
node index.js
```

> If `ANTHROPIC_API_KEY` is empty, the agent runs in mock mode and simulates decisions based on the health factor — no API key needed for local demo.

### 8. Start the frontend

```bash
cd frontend && npm install && npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and connect MetaMask.

For local Anvil, add this network to MetaMask:
- RPC URL: `http://127.0.0.1:8545`
- Chain ID: `31337`

Then import the Anvil owner key (dev only — never use on mainnet):
```
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

## Deploying to Ethereum Sepolia

1. Fund your wallet with Sepolia ETH — [faucet.quicknode.com](https://faucet.quicknode.com)
2. Set `PRIVATE_KEY` and `SEPOLIA_RPC_URL` in `.env`
3. Deploy:

```bash
make deploy-sepolia
```

Or deploy and verify on Etherscan:

```bash
make deploy-sepolia-verify
```

4. Update `frontend/.env` with the new vault address and restart the frontend.

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

make agent-dev              Start agent backend
make frontend-dev           Start frontend dev server
```

## Sponsor integrations

- **Chainlink** — ETH/USD price feed (`0x694AA1769357215DE4FAC081bf1f309aDC325306`) enforced as Rule 6 on every agent action
- **Aave v3** — health factor read from live position as Rule 5
- **ENS** — wallet address resolution in the frontend

## License

MIT
