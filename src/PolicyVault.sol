// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

// Aave v3 pool interface — used to read the owner's health factor
import "./interfaces/IAavePool.sol";

// Official Chainlink interface — used to read live asset prices from price feeds
import {AggregatorV3Interface} from "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

// Minimal ERC-20 interface — used to read token balances held by the vault
interface IERC20 {
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title  PolicyVault
 * @notice On-chain policy firewall between an AI agent and DeFi protocols.
 *         Every agent transaction must pass execute(), which enforces six rules
 *         before forwarding the call. The wallet owner keeps an instant kill switch.
 *
 * Rules enforced in execute():
 *   1. Kill switch       — is the agent revoked?
 *   2. Whitelist         — is the target contract on the allowed list?
 *   3. Spend cap         — does the ETH value exceed maxTxAmount?
 *   4. Cooldown          — has enough time passed since the last execution?
 *   5. Aave health factor — is the Aave position above the safety floor?
 *   6. Chainlink price    — is the tracked asset price above the minimum?
 *
 * Balance tracking:
 *   Events are emitted on every balance change — ETH deposits, ETH sent via
 *   execute(), and ERC-20 balance snapshots — so the dashboard can show a
 *   live balance feed without polling the chain.
 */
contract PolicyVault {

    // ─── Custom Errors ────────────────────────────────────────────────────────

    error NotOwner();                                             // caller is not the vault owner
    error NotAgent();                                            // caller is not the registered agent
    error Revoked();                                             // agent has been emergency-revoked
    error TargetNotAllowed(address target);                      // target contract is not whitelisted
    error AmountExceedsLimit(uint256 requested, uint256 limit); // ETH value exceeds spend cap
    error CooldownActive(uint256 availableAt, uint256 now_);    // cooldown period has not elapsed
    error HealthFactorTooLow(uint256 current, uint256 floor);   // Aave HF is below the configured floor
    error PriceBelowFloor(int256 current, int256 floor);        // Chainlink price is below the minimum
    error StalePrice(uint256 updatedAt, uint256 maxAge);        // Chainlink data is too old
    error CallFailed(bytes reason);                              // the forwarded call reverted

    // ─── Events ───────────────────────────────────────────────────────────────

    // Fired when the agent's call passes all checks and is forwarded to the target
    event ExecutionAllowed(address indexed agent, address indexed target, uint256 amount);

    // Fired when the owner kills the agent's access
    event AgentRevoked(address indexed owner, address indexed agent);

    // Fired when the owner re-enables a previously revoked agent
    event AgentReinstated(address indexed owner, address indexed agent);

    // Fired when the owner updates any policy parameter
    event PolicyUpdated(address indexed owner);

    // ── Balance events ────────────────────────────────────────────────────────

    // Fired when ETH is deposited into the vault (via receive())
    event ETHDeposited(
        address indexed from,    // sender of the ETH
        uint256 amount,          // how much ETH was received (wei)
        uint256 newBalance       // vault's total ETH balance after deposit
    );

    // Fired after execute() forwards ETH to a target contract
    event ETHSent(
        address indexed target,  // contract that received the ETH
        uint256 amount,          // how much ETH was sent (wei)
        uint256 newBalance       // vault's remaining ETH balance after the send
    );

    // Fired after every execute() call with a snapshot of a tracked ERC-20 balance
    // Lets the dashboard track USDC/WETH/etc. without separate polling
    event TokenBalanceSnapshot(
        address indexed token,   // ERC-20 contract address
        uint256 balance          // vault's current balance of that token
    );

    // ─── State Variables ──────────────────────────────────────────────────────

    // Vault owner — set once at deployment, can never be changed
    address public immutable owner;

    // Registered AI agent — the only address that may call execute()
    address public agent;

    // When true, the agent is locked out and every execute() call reverts
    bool public isRevoked;

    // ── Policy parameters (all adjustable by owner) ───────────────────────────

    // Max ETH value (wei) the agent may forward in a single execute() call
    uint256 public maxTxAmount;

    // Minimum seconds between two consecutive successful execute() calls
    uint256 public cooldownPeriod;

    // Minimum Aave health factor before the agent may act (1e18 scale; e.g. 1.5e18)
    uint256 public healthFactorFloor;

    // Minimum asset price from the Chainlink feed (8-decimal USD; e.g. 150000000000 = $1500.00)
    // Set to 0 to skip the Chainlink price check
    int256 public minAssetPriceUSD;

    // Maximum age of a Chainlink price answer before it is considered stale (seconds)
    uint256 public maxPriceAge;

    // Timestamp of the last successful execute() — used for cooldown math
    uint256 public lastExecutionTime;

    // Whitelist of contract addresses the agent is allowed to call
    address[] private _allowedProtocols;

    // ERC-20 addresses whose balances are snapshotted after every execute()
    // Lets the dashboard track token balances without extra calls
    address[] private _trackedTokens;

    // ── External integrations ─────────────────────────────────────────────────

    // Aave v3 pool — used to read the owner's health factor in execute()
    // Set to address(0) to disable the health factor check
    IAavePool public aavePool;

    // Chainlink price feed (e.g. ETH/USD on Base Sepolia)
    // Set to address(0) to disable the price floor check
    AggregatorV3Interface public priceFeed;

    // ─── Modifiers ────────────────────────────────────────────────────────────

    // Only the vault owner may call this function
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    // Only the registered agent may call this function
    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    /**
     * @param _agent             AI agent wallet address
     * @param _maxTxAmount       Max ETH per call (wei)
     * @param _cooldownPeriod    Seconds between executions (e.g. 1800 = 30 min)
     * @param _healthFactorFloor Min Aave HF (1e18 = 1.0; e.g. 1.5e18 = 1.5)
     * @param _minAssetPriceUSD  Min Chainlink price (8 dec USD); 0 = skip check
     * @param allowedProtocols   Initial protocol whitelist
     * @param trackedTokens      ERC-20 addresses to snapshot after every execute()
     * @param _aavePool          Aave v3 pool address; address(0) = skip HF check
     * @param _priceFeed         Chainlink feed address; address(0) = skip price check
     */
    constructor(
        address _agent,
        uint256 _maxTxAmount,
        uint256 _cooldownPeriod,
        uint256 _healthFactorFloor,
        int256  _minAssetPriceUSD,
        address[] memory allowedProtocols,
        address[] memory trackedTokens,
        address _aavePool,
        address _priceFeed
    ) {
        owner             = msg.sender;                      // deployer is the permanent owner
        agent             = _agent;                          // register the AI agent
        maxTxAmount       = _maxTxAmount;                    // spend cap
        cooldownPeriod    = _cooldownPeriod;                 // time-lock between actions
        healthFactorFloor = _healthFactorFloor;              // Aave safety floor
        minAssetPriceUSD  = _minAssetPriceUSD;              // Chainlink price floor
        maxPriceAge       = 3600;                            // default: reject prices older than 1 hour
        _allowedProtocols = allowedProtocols;                // protocol whitelist
        _trackedTokens    = trackedTokens;                   // tokens to balance-snapshot
        aavePool          = IAavePool(_aavePool);            // Aave pool reference
        priceFeed         = AggregatorV3Interface(_priceFeed); // Chainlink feed reference
    }

    // ─── Core: execute ────────────────────────────────────────────────────────

    /**
     * @notice The single entry-point for every agent-initiated transaction.
     *         Runs all six policy checks, then forwards the call to `target`.
     *         Emits balance events after the call so the dashboard stays in sync.
     *
     * @param target    Whitelisted contract to call (e.g. Aave pool)
     * @param amount    ETH value to forward (wei); 0 for ERC-20-only calls
     * @param callData  ABI-encoded function call for target
     * @return result   Raw return bytes from the target contract
     */
    function execute(address target, uint256 amount, bytes calldata callData)
        external
        onlyAgent
        returns (bytes memory result)
    {
        // Rule 1 — Kill switch: if the owner has revoked access, block immediately
        if (isRevoked) revert Revoked();

        // Rule 2 — Whitelist: the target must be on the allowed protocol list
        if (!_isAllowed(target)) revert TargetNotAllowed(target);

        // Rule 3 — Spend cap: the ETH value must not exceed the configured limit
        if (amount > maxTxAmount) revert AmountExceedsLimit(amount, maxTxAmount);

        // Rule 4 — Cooldown: enough time must have passed since the last execution
        uint256 availableAt = lastExecutionTime + cooldownPeriod;
        if (block.timestamp < availableAt) revert CooldownActive(availableAt, block.timestamp);

        // Rule 5 — Aave health factor: position must be above the safety floor
        // getUserAccountData reads Chainlink price feeds internally to compute the HF
        if (address(aavePool) != address(0)) {
            (,,,,, uint256 hf) = aavePool.getUserAccountData(owner);
            if (hf < healthFactorFloor) revert HealthFactorTooLow(hf, healthFactorFloor);
        }

        // Rule 6 — Chainlink price floor: asset price must be above the minimum
        if (address(priceFeed) != address(0) && minAssetPriceUSD > 0) {
            // Fetch the latest price round from the Chainlink aggregator
            (, int256 price,, uint256 updatedAt,) = priceFeed.latestRoundData();

            // Reject if the price data is older than maxPriceAge (stale feed protection)
            if (block.timestamp - updatedAt > maxPriceAge) revert StalePrice(updatedAt, maxPriceAge);

            // Reject if the price has dropped below the owner's configured floor
            if (price < minAssetPriceUSD) revert PriceBelowFloor(price, minAssetPriceUSD);
        }

        // All rules passed — stamp the execution time to start the next cooldown window
        lastExecutionTime = block.timestamp;

        // Notify the dashboard that this action was approved
        emit ExecutionAllowed(msg.sender, target, amount);

        // Forward the call to the target contract, sending `amount` ETH if specified
        bool success;
        (success, result) = target.call{value: amount}(callData);
        // Bubble up the revert reason if the target call failed
        if (!success) revert CallFailed(result);

        // ── Balance tracking after the call ───────────────────────────────────

        // If ETH was sent out, emit the vault's new ETH balance
        if (amount > 0) {
            emit ETHSent(target, amount, address(this).balance);
        }

        // Snapshot every tracked ERC-20 token balance so the dashboard stays current
        _emitTokenSnapshots();
    }

    // ─── Kill Switch ──────────────────────────────────────────────────────────

    /**
     * @notice Instantly cuts off the agent's access.
     *         Any subsequent execute() call will revert until reinstated.
     *         Only the owner can call this.
     */
    function emergencyRevoke() external onlyOwner {
        isRevoked = true;
        emit AgentRevoked(owner, agent);
    }

    /**
     * @notice Re-enables a previously revoked agent.
     *         Only the owner can call this.
     */
    function reinstateAgent() external onlyOwner {
        isRevoked = false;
        emit AgentReinstated(owner, agent);
    }

    // ─── Policy Management ────────────────────────────────────────────────────

    /**
     * @notice Updates all numeric policy parameters in one transaction.
     *         Called by the dashboard when the owner adjusts toggles/sliders.
     */
    function setPolicy(
        uint256 _maxTxAmount,
        uint256 _cooldownPeriod,
        uint256 _healthFactorFloor,
        int256  _minAssetPriceUSD
    ) external onlyOwner {
        maxTxAmount       = _maxTxAmount;       // update spend cap
        cooldownPeriod    = _cooldownPeriod;    // update time-lock
        healthFactorFloor = _healthFactorFloor; // update Aave floor
        minAssetPriceUSD  = _minAssetPriceUSD;  // update Chainlink price floor
        emit PolicyUpdated(owner);
    }

    /**
     * @notice Replaces the entire protocol whitelist.
     *         Pass an empty array to block all targets.
     */
    function setAllowedProtocols(address[] calldata protocols) external onlyOwner {
        _allowedProtocols = protocols;
    }

    /**
     * @notice Updates the Chainlink price feed and staleness window.
     *         Pass address(0) to disable the price check.
     */
    function setPriceFeed(address _feed, uint256 _maxPriceAge) external onlyOwner {
        priceFeed   = AggregatorV3Interface(_feed); // set the new Chainlink feed
        maxPriceAge = _maxPriceAge;                 // update staleness threshold
    }

    /**
     * @notice Updates the Aave pool address.
     *         Pass address(0) to disable the health factor check.
     */
    function setAavePool(address _pool) external onlyOwner {
        aavePool = IAavePool(_pool);
    }

    /**
     * @notice Replaces the list of ERC-20 tokens whose balances are snapshotted
     *         after every execute() call.
     */
    function setTrackedTokens(address[] calldata tokens) external onlyOwner {
        _trackedTokens = tokens;
    }

    /**
     * @notice Rotates the registered agent address.
     *         Use this to swap the agent wallet without redeploying.
     */
    function setAgent(address _agent) external onlyOwner {
        agent = _agent;
    }

    // ─── View Functions ───────────────────────────────────────────────────────

    /**
     * @notice Returns the vault's current ETH balance.
     *         Called by the dashboard to display available ETH.
     */
    function getVaultETHBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /**
     * @notice Returns the vault's balance of a specific ERC-20 token.
     * @param token  ERC-20 contract address (e.g. USDC on Base Sepolia)
     */
    function getTokenBalance(address token) external view returns (uint256) {
        return IERC20(token).balanceOf(address(this));
    }

    /**
     * @notice Returns the current whitelist of allowed protocol addresses.
     */
    function getAllowedProtocols() external view returns (address[] memory) {
        return _allowedProtocols;
    }

    /**
     * @notice Returns the list of ERC-20 tokens being balance-tracked.
     */
    function getTrackedTokens() external view returns (address[] memory) {
        return _trackedTokens;
    }

    /**
     * @notice Full policy snapshot — used by the dashboard to populate all panels.
     */
    function getPolicy()
        external
        view
        returns (
            address _agent,
            bool    _isRevoked,
            uint256 _maxTxAmount,
            uint256 _cooldownPeriod,
            uint256 _healthFactorFloor,
            int256  _minAssetPriceUSD,
            uint256 _lastExecutionTime,
            address[] memory _protocols
        )
    {
        return (
            agent,
            isRevoked,
            maxTxAmount,
            cooldownPeriod,
            healthFactorFloor,
            minAssetPriceUSD,
            lastExecutionTime,
            _allowedProtocols
        );
    }

    /**
     * @notice Returns seconds until the current cooldown expires.
     *         Returns 0 if the agent is ready to act now.
     */
    function cooldownRemaining() external view returns (uint256) {
        uint256 availableAt = lastExecutionTime + cooldownPeriod;
        return block.timestamp >= availableAt ? 0 : availableAt - block.timestamp;
    }

    /**
     * @notice Returns the owner's current Aave health factor.
     *         Returns type(uint256).max when no pool is configured (no risk).
     */
    function getHealthFactor() external view returns (uint256) {
        if (address(aavePool) == address(0)) return type(uint256).max;
        (,,,,, uint256 hf) = aavePool.getUserAccountData(owner);
        return hf;
    }

    /**
     * @notice Returns the latest Chainlink price and its timestamp.
     *         Returns (0, 0) when no feed is configured.
     *         Used by the dashboard to display the live asset price.
     */
    function getLatestPrice() external view returns (int256 price, uint256 updatedAt) {
        if (address(priceFeed) == address(0)) return (0, 0);
        (, price,, updatedAt,) = priceFeed.latestRoundData();
    }

    // ─── Internal Helpers ─────────────────────────────────────────────────────

    /**
     * @notice Returns true if `target` is in the protocol whitelist.
     */
    function _isAllowed(address target) internal view returns (bool) {
        address[] memory p = _allowedProtocols; // load to memory for cheaper reads
        for (uint256 i = 0; i < p.length; i++) {
            if (p[i] == target) return true;
        }
        return false;
    }

    /**
     * @notice Emits a TokenBalanceSnapshot for every tracked ERC-20 token.
     *         Called at the end of execute() so the dashboard sees updated balances
     *         immediately after any agent action.
     */
    function _emitTokenSnapshots() internal {
        address[] memory tokens = _trackedTokens;
        for (uint256 i = 0; i < tokens.length; i++) {
            // Read the vault's current balance of this token and broadcast it
            emit TokenBalanceSnapshot(tokens[i], IERC20(tokens[i]).balanceOf(address(this)));
        }
    }

    // ─── Receive ETH ──────────────────────────────────────────────────────────

    /**
     * @notice Called automatically when ETH is sent directly to the vault.
     *         Emits ETHDeposited so the dashboard shows the incoming balance update.
     */
    receive() external payable {
        // Record who sent ETH, how much, and the vault's new total balance
        emit ETHDeposited(msg.sender, msg.value, address(this).balance);
    }
}
