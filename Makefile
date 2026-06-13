-include .env

.PHONY: build test deploy-local deploy-testnet deploy-sepolia deploy-sepolia-verify clean install format

# ── Build ──────────────────────────────────────────────────────────────────────
build:
	forge build

# ── Test ───────────────────────────────────────────────────────────────────────
test:
	forge test -v

test-watch:
	forge test --watch

test-rule1:
	forge test --match-test "Revoke|Reinstate" -v

test-rule2:
	forge test --match-test "BlockedTarget" -v

test-rule3:
	forge test --match-test "AmountExceedsLimit" -v

test-rule4:
	forge test --match-test "Cooldown" -v

test-rule5:
	forge test --match-test "HealthFactor" -v

test-rule6:
	forge test --match-test "Price|Stale" -v

# ── Deploy ─────────────────────────────────────────────────────────────────────

# Deploy to local Anvil (start anvil in a separate terminal first)
deploy-local:
	forge script script/Deploy.s.sol \
		--rpc-url http://127.0.0.1:8545 \
		--broadcast \
		-v

# Deploy to Base Sepolia testnet
deploy-testnet:
	forge script script/Deploy.s.sol \
		--rpc-url https://sepolia.base.org \
		--broadcast \
		-v

# Deploy to Base Sepolia and verify on Basescan
deploy-verify:
	forge script script/Deploy.s.sol \
		--rpc-url https://sepolia.base.org \
		--broadcast \
		--verify \
		--etherscan-api-key $(ETHERSCAN_API_KEY) \
		-v

# Deploy to Ethereum Sepolia
deploy-sepolia:
	forge script script/DeploySepolia.s.sol \
		--rpc-url $(SEPOLIA_RPC_URL) \
		--broadcast \
		-v

# Deploy to Ethereum Sepolia and verify on Etherscan
deploy-sepolia-verify:
	forge script script/DeploySepolia.s.sol \
		--rpc-url $(SEPOLIA_RPC_URL) \
		--broadcast \
		--verify \
		--etherscan-api-key $(ETHERSCAN_API_KEY) \
		-v

# ── Local chain ────────────────────────────────────────────────────────────────
anvil:
	anvil --block-time 2

# ── Wallet ─────────────────────────────────────────────────────────────────────

# Generate a new wallet keypair (e.g. for a fresh agent wallet)
wallet-new:
	cast wallet new

# Check ETH balance of any address: make balance ADDR=0x...
balance:
	cast balance $(ADDR) --rpc-url https://sepolia.base.org --ether

# ── Contract interactions (Base Sepolia) ───────────────────────────────────────

# Read the full policy from a deployed vault: make policy VAULT=0x...
policy:
	cast call $(VAULT) "getPolicy()" --rpc-url https://sepolia.base.org

# Read health factor: make hf VAULT=0x...
hf:
	cast call $(VAULT) "getHealthFactor()" --rpc-url https://sepolia.base.org

# Read live Chainlink price: make price VAULT=0x...
price:
	cast call $(VAULT) "getLatestPrice()" --rpc-url https://sepolia.base.org

# Read cooldown remaining: make cooldown VAULT=0x...
cooldown:
	cast call $(VAULT) "cooldownRemaining()" --rpc-url https://sepolia.base.org

# Emergency revoke — owner only: make revoke VAULT=0x...
revoke:
	cast send $(VAULT) "emergencyRevoke()" \
		--private-key $(PRIVATE_KEY) \
		--rpc-url https://sepolia.base.org

# Reinstate agent — owner only: make reinstate VAULT=0x...
reinstate:
	cast send $(VAULT) "reinstateAgent()" \
		--private-key $(PRIVATE_KEY) \
		--rpc-url https://sepolia.base.org

# ── Utilities ──────────────────────────────────────────────────────────────────
install:
	forge install

clean:
	forge clean

format:
	forge fmt

# ── Agent backend ──────────────────────────────────────────────────────────────
agent-install:
	cd agent && npm install

agent-start:
	cd agent && npm start

agent-dev:
	cd agent && npm run dev

# ── Frontend ───────────────────────────────────────────────────────────────────
frontend-install:
	cd frontend && npm install

frontend-dev:
	cd frontend && npm run dev

frontend-build:
	cd frontend && npm run build

# ── Help ───────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "One-Agent — available commands"
	@echo "────────────────────────────────────────────"
	@echo "  make build              Build contracts"
	@echo "  make test               Run all 25 tests"
	@echo "  make test-rule1         Kill switch tests"
	@echo "  make test-rule2         Whitelist tests"
	@echo "  make test-rule3         Spend cap tests"
	@echo "  make test-rule4         Cooldown tests"
	@echo "  make test-rule5         Health factor tests"
	@echo "  make test-rule6         Chainlink price tests"
	@echo "────────────────────────────────────────────"
	@echo "  make anvil              Start local chain"
	@echo "  make deploy-local       Deploy to Anvil"
	@echo "  make deploy-testnet     Deploy to Base Sepolia"
	@echo "  make deploy-verify      Deploy + verify on Basescan"
	@echo "  make deploy-sepolia     Deploy to Ethereum Sepolia"
	@echo "  make deploy-sepolia-verify  Deploy + verify on Etherscan"
	@echo "────────────────────────────────────────────"
	@echo "  make wallet-new         Generate new keypair"
	@echo "  make balance ADDR=0x... Check ETH balance"
	@echo "  make policy  VAULT=0x.. Read vault policy"
	@echo "  make hf      VAULT=0x.. Read health factor"
	@echo "  make price   VAULT=0x.. Read Chainlink price"
	@echo "  make cooldown VAULT=0x. Read cooldown remaining"
	@echo "  make revoke  VAULT=0x.. Emergency revoke agent"
	@echo "  make reinstate VAULT=0x Reinstate agent"
	@echo "────────────────────────────────────────────"
	@echo "  make agent-install      Install agent deps"
	@echo "  make agent-dev          Start agent backend"
	@echo "  make frontend-install   Install frontend deps"
	@echo "  make frontend-dev       Start frontend dev server"
	@echo ""
