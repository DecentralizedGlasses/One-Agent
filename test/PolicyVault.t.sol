// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PolicyVault.sol";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Simulates the Aave v3 pool — lets tests set any health factor
contract MockAavePool {
    uint256 public healthFactor = 2e18; // default: healthy (2.0)

    function setHealthFactor(uint256 hf) external { healthFactor = hf; }

    function getUserAccountData(address)
        external view
        returns (uint256, uint256, uint256, uint256, uint256, uint256)
    {
        return (0, 0, 0, 0, 0, healthFactor);
    }
}

// Simulates a Chainlink price feed — lets tests set any price and timestamp
contract MockPriceFeed {
    int256  public price     = 2000e8;          // default: $2000.00 (8 decimals)
    uint256 public updatedAt = block.timestamp; // default: fresh

    function setPrice(int256 _price) external { price = _price; }
    function setUpdatedAt(uint256 _updatedAt) external { updatedAt = _updatedAt; }

    function latestRoundData()
        external view
        returns (uint80, int256, uint256, uint256, uint80)
    {
        return (1, price, 0, updatedAt, 1);
    }
}

// Simple target contract that records how many times it was called
contract MockTarget {
    uint256 public callCount;

    function doSomething(uint256) external payable returns (uint256) {
        callCount++;
        return callCount;
    }
}

// Mock ERC-20 that returns a fixed balance — for testing TokenBalanceSnapshot
contract MockERC20 {
    uint256 public bal;
    constructor(uint256 _bal) { bal = _bal; }
    function balanceOf(address) external view returns (uint256) { return bal; }
}

// ── Test suite ────────────────────────────────────────────────────────────────

contract PolicyVaultTest is Test {
    PolicyVault  vault;
    MockAavePool aave;
    MockPriceFeed feed;
    MockTarget   allowedTarget;
    MockTarget   blockedTarget;
    MockERC20    usdc;

    address owner  = makeAddr("owner");
    address agent  = makeAddr("agent");
    address hacker = makeAddr("hacker");

    function setUp() public {
        vm.warp(2 hours); // ensure block.timestamp > cooldownPeriod (1800s)

        aave          = new MockAavePool();
        feed          = new MockPriceFeed();
        allowedTarget = new MockTarget();
        blockedTarget = new MockTarget();
        usdc          = new MockERC20(500e6); // pretend vault holds 500 USDC

        address[] memory protocols = new address[](1);
        protocols[0] = address(allowedTarget);

        address[] memory tracked = new address[](1);
        tracked[0] = address(usdc); // track USDC balance snapshots

        vm.prank(owner);
        vault = new PolicyVault(
            agent,
            500e6,              // maxTxAmount: 500 USDC units
            30 minutes,         // cooldownPeriod
            15e17,              // healthFactorFloor: 1.5
            1500e8,             // minAssetPriceUSD: $1500.00 (8 dec)
            protocols,
            tracked,
            address(aave),
            address(feed)
        );

        vm.deal(address(vault), 10 ether); // fund vault with ETH
    }

    // ── Happy path ────────────────────────────────────────────────────────────

    // test that the agent can execute allowed targets
    function test_AllowedExecution() public {
        bytes memory cd = abi.encodeWithSelector(MockTarget.doSomething.selector, 1);
        vm.prank(agent);
        vault.execute(address(allowedTarget), 0, cd);
        assertEq(allowedTarget.callCount(), 1);
    }

    // test that the cooldown period works as expected
    function test_CooldownExpiry_AllowsSecondCall() public {
        bytes memory cd = abi.encodeWithSelector(MockTarget.doSomething.selector, 1);
        vm.prank(agent); vault.execute(address(allowedTarget), 0, cd);

        vm.warp(block.timestamp + 30 minutes + 1); // advance past cooldown

        vm.prank(agent); vault.execute(address(allowedTarget), 0, cd);
        assertEq(allowedTarget.callCount(), 2);
    }

    // ── Kill switch ───────────────────────────────────────────────────────────

    // test for emergency revocation when the vault is in an emergency state
    function test_EmergencyRevoke_BlocksAgent() public {
        vm.prank(owner); vault.emergencyRevoke();

        bytes memory cd = abi.encodeWithSelector(MockTarget.doSomething.selector, 1);
        vm.prank(agent);
        vm.expectRevert(PolicyVault.Revoked.selector);
        vault.execute(address(allowedTarget), 0, cd);
    }

    // testing only owner can revoke the agent to the vault
    function test_OnlyOwnerCanRevoke() public {
        vm.prank(hacker);
        vm.expectRevert(PolicyVault.NotOwner.selector);
        vault.emergencyRevoke();
    }

    // testing only owner can reinstate the agent to the vault
    function test_OnlyOwnerCanReinstate() public {
        vm.prank(owner);
        vault.emergencyRevoke();

        vm.prank(hacker);
        vm.expectRevert(PolicyVault.NotOwner.selector);
        vault.reinstateAgent();
    }

    // testing that the agent can execute after being reinstated
    function test_Reinstate_AllowsExecution() public {
        vm.prank(owner);
        vault.emergencyRevoke();

        vm.prank(owner);
        vault.reinstateAgent();

        bytes memory cd = abi.encodeWithSelector(MockTarget.doSomething.selector, 1);
        vm.prank(agent); vault.execute(address(allowedTarget), 0, cd);
        assertEq(allowedTarget.callCount(), 1);
    }

    // ── Whitelist ─────────────────────────────────────────────────────────────

    // testing that a blocked target cannot be executed
    function test_BlockedTarget_Reverts() public {
        bytes memory cd = abi.encodeWithSelector(MockTarget.doSomething.selector, 1);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(PolicyVault.TargetNotAllowed.selector, address(blockedTarget)));
        vault.execute(address(blockedTarget), 0, cd);
    }

    // ── Spend cap ─────────────────────────────────────────────────────────────

    // testing that an amount exceeding the spend cap reverts
    function test_AmountExceedsLimit_Reverts() public {
        bytes memory cd = abi.encodeWithSelector(MockTarget.doSomething.selector, 1);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(PolicyVault.AmountExceedsLimit.selector, 501e6, 500e6));
        vault.execute(address(allowedTarget), 501e6, cd);
    }

    // ── Cooldown ──────────────────────────────────────────────────────────────

    // testing that the agent cannot execute during the cooldown period
    function test_Cooldown_BlocksSecondCall() public {
        bytes memory cd = abi.encodeWithSelector(MockTarget.doSomething.selector, 1);
        vm.prank(agent); vault.execute(address(allowedTarget), 0, cd);

        vm.prank(agent);
        vm.expectRevert(); // CooldownActive
        vault.execute(address(allowedTarget), 0, cd);
    }

    // ── Aave health factor ────────────────────────────────────────────────────
    // test to check health works as expected
    function test_LowHealthFactor_Blocks() public {
        aave.setHealthFactor(1e18); // drop to 1.0 — below floor of 1.5

        bytes memory cd = abi.encodeWithSelector(MockTarget.doSomething.selector, 1);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(PolicyVault.HealthFactorTooLow.selector, 1e18, 15e17));
        vault.execute(address(allowedTarget), 0, cd);
    }

    // ── Chainlink price floor ─────────────────────────────────────────────────

    // test to check that a price below the floor reverts
    function test_PriceBelowFloor_Blocks() public {
        feed.setPrice(1000e8); // drop ETH to $1000 — below floor of $1500

        bytes memory cd = abi.encodeWithSelector(MockTarget.doSomething.selector, 1);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(PolicyVault.PriceBelowFloor.selector, 1000e8, 1500e8));
        vault.execute(address(allowedTarget), 0, cd);
    }

    // test to check that a stale price feed reverts
    function test_StalePriceFeed_Blocks() public {
        // Set updatedAt to 2 hours ago — exceeds maxPriceAge of 1 hour
        feed.setUpdatedAt(block.timestamp - 2 hours);

        bytes memory cd = abi.encodeWithSelector(MockTarget.doSomething.selector, 1);
        vm.prank(agent);
        vm.expectRevert(); // StalePrice
        vault.execute(address(allowedTarget), 0, cd);
    }

    // test that a price above the floor allows execution
    function test_PriceAboveFloor_Allows() public {
        feed.setPrice(2500e8); // ETH at $2500 — above floor of $1500

        bytes memory cd = abi.encodeWithSelector(MockTarget.doSomething.selector, 1);
        vm.prank(agent);
        vault.execute(address(allowedTarget), 0, cd);
        assertEq(allowedTarget.callCount(), 1);
    }

    // ── Balance events ────────────────────────────────────────────────────────

    function test_ETHDeposited_Event() public {
        vm.expectEmit(true, false, false, true);
        emit PolicyVault.ETHDeposited(address(this), 1 ether, 11 ether); // vault had 10, now 11

        (bool ok,) = address(vault).call{value: 1 ether}("");
        assertTrue(ok);
    }

    // test that the token balance snapshot event is emitted after a successful execute
    function test_TokenBalanceSnapshot_EmittedAfterExecute() public {
        bytes memory cd = abi.encodeWithSelector(MockTarget.doSomething.selector, 1);

        vm.expectEmit(true, false, false, true);
        emit PolicyVault.TokenBalanceSnapshot(address(usdc), 500e6);

        vm.prank(agent);
        vault.execute(address(allowedTarget), 0, cd);
    }

    // test that the ETH sent event is emitted correctly
    function test_ETHSent_Event() public {
        bytes memory cd = abi.encodeWithSelector(MockTarget.doSomething.selector, 1);

        // Send 1 wei of ETH through execute — vault started with 10 ether
        vm.expectEmit(true, false, false, true);
        emit PolicyVault.ETHSent(address(allowedTarget), 1, 10 ether - 1);

        vm.prank(agent);
        vault.execute(address(allowedTarget), 1, cd); // 1 wei, within 500e6 cap
    }

    // ── Access control ────────────────────────────────────────────────────────

    // test that only the agent can execute transactions
    function test_OnlyAgentCanExecute() public {
        bytes memory cd = abi.encodeWithSelector(MockTarget.doSomething.selector, 1);
        vm.prank(agent);
        vault.execute(address(allowedTarget), 0, cd);
    }

    // test that a non-agent cannot execute transactions
    function test_NonAgent_Reverts() public {
        bytes memory cd = abi.encodeWithSelector(MockTarget.doSomething.selector, 1);
        vm.prank(hacker);
        vm.expectRevert(PolicyVault.NotAgent.selector);
        vault.execute(address(allowedTarget), 0, cd);
    }

    // ── Policy updates ────────────────────────────────────────────────────────

    // test that only the owner can update the policy
    function test_OwnerCanUpdatePolicy() public {
        vm.prank(owner);
        vault.setPolicy(1000e6, 1 hours, 12e17, 1200e8);
        assertEq(vault.maxTxAmount(),       1000e6);
        assertEq(vault.cooldownPeriod(),    1 hours);
        assertEq(vault.healthFactorFloor(), 12e17);
        assertEq(vault.minAssetPriceUSD(),  1200e8);
    }

    // test that when a non-owner tries to update the policy, it reverts
    function test_NonOwnerCannotUpdatePolicy() public {
        vm.prank(hacker);
        vm.expectRevert(PolicyVault.NotOwner.selector);
        vault.setPolicy(1000e6, 1 hours, 12e17, 1200e8);
    }

    // ── View helpers ──────────────────────────────────────────────────────────

    function test_GetPolicy() public view {
        (address a, bool revoked,,,,,,) = vault.getPolicy();
        assertEq(a, agent);
        assertFalse(revoked);
    }

    function test_CooldownRemaining_ZeroWhenReady() public view {
        assertEq(vault.cooldownRemaining(), 0);
    }

    function test_GetLatestPrice() public view {
        (int256 price,) = vault.getLatestPrice();
        assertEq(price, 2000e8); // mock default
    }

    function test_GetHealthFactor() public view {
        assertEq(vault.getHealthFactor(), 2e18); // mock default
    }

    function test_GetVaultETHBalance() public view {
        assertEq(vault.getVaultETHBalance(), 10 ether);
    }
}
