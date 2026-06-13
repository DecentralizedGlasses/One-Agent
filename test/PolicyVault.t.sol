// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/PolicyVault.sol";

contract MockAavePool {
    uint256 public healthFactor = 2e18;

    function setHealthFactor(uint256 hf) external { healthFactor = hf; }

    function getUserAccountData(address)
        external
        view
        returns (uint256, uint256, uint256, uint256, uint256, uint256)
    {
        return (0, 0, 0, 0, 0, healthFactor);
    }
}

contract MockTarget {
    uint256 public callCount;

    function doSomething(uint256) external payable returns (uint256) {
        callCount++;
        return callCount;
    }
}

contract PolicyVaultTest is Test {
    PolicyVault vault;
    MockAavePool aave;
    MockTarget allowedTarget;
    MockTarget blockedTarget;

    address owner  = makeAddr("owner");
    address agent  = makeAddr("agent");
    address hacker = makeAddr("hacker");

    function setUp() public {
        vm.warp(2 hours); // ensure block.timestamp > cooldownPeriod (1800s)

        aave           = new MockAavePool();
        allowedTarget  = new MockTarget();
        blockedTarget  = new MockTarget();

        address[] memory protocols = new address[](1);
        protocols[0] = address(allowedTarget);

        vm.prank(owner);
        vault = new PolicyVault(
            agent,
            500e6,       // maxTxAmount: 500 USDC (6 dec)
            30 minutes,  // cooldownPeriod
            15e17,       // healthFactorFloor: 1.5
            protocols,
            address(aave)
        );
        vm.deal(address(vault), 10 ether);
    }

    // ── Happy path ──────────────────────────────────────────────────────────────

    function test_AllowedExecution() public {
        bytes memory cd = abi.encodeWithSelector(MockTarget.doSomething.selector, 1);
        vm.prank(agent);
        vault.execute(address(allowedTarget), 0, cd);
        assertEq(allowedTarget.callCount(), 1);
    }

    function test_CooldownExpiry_AllowsSecondCall() public {
        bytes memory cd = abi.encodeWithSelector(MockTarget.doSomething.selector, 1);
        vm.prank(agent); vault.execute(address(allowedTarget), 0, cd);
        vm.warp(block.timestamp + 30 minutes + 1);
        vm.prank(agent); vault.execute(address(allowedTarget), 0, cd);
        assertEq(allowedTarget.callCount(), 2);
    }

    // ── Kill switch ─────────────────────────────────────────────────────────────

    function test_EmergencyRevoke_BlocksAgent() public {
        vm.prank(owner); vault.emergencyRevoke();

        bytes memory cd = abi.encodeWithSelector(MockTarget.doSomething.selector, 1);
        vm.prank(agent);
        vm.expectRevert(PolicyVault.Revoked.selector);
        vault.execute(address(allowedTarget), 0, cd);
    }

    function test_OnlyOwnerCanRevoke() public {
        vm.prank(hacker);
        vm.expectRevert(PolicyVault.NotOwner.selector);
        vault.emergencyRevoke();
    }

    function test_Reinstate_AllowsExecution() public {
        vm.prank(owner); vault.emergencyRevoke();
        vm.prank(owner); vault.reinstateAgent();

        bytes memory cd = abi.encodeWithSelector(MockTarget.doSomething.selector, 1);
        vm.prank(agent); vault.execute(address(allowedTarget), 0, cd);
        assertEq(allowedTarget.callCount(), 1);
    }

    // ── Whitelist ───────────────────────────────────────────────────────────────

    function test_BlockedTarget_Reverts() public {
        bytes memory cd = abi.encodeWithSelector(MockTarget.doSomething.selector, 1);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(PolicyVault.TargetNotAllowed.selector, address(blockedTarget)));
        vault.execute(address(blockedTarget), 0, cd);
    }

    // ── Spend cap ───────────────────────────────────────────────────────────────

    function test_AmountExceedsLimit_Reverts() public {
        bytes memory cd = abi.encodeWithSelector(MockTarget.doSomething.selector, 1);
        vm.prank(agent);
        vm.expectRevert(abi.encodeWithSelector(PolicyVault.AmountExceedsLimit.selector, 501e6, 500e6));
        vault.execute(address(allowedTarget), 501e6, cd);
    }

    // ── Cooldown ────────────────────────────────────────────────────────────────

    function test_Cooldown_BlocksSecondCall() public {
        bytes memory cd = abi.encodeWithSelector(MockTarget.doSomething.selector, 1);
        vm.prank(agent); vault.execute(address(allowedTarget), 0, cd);
        vm.prank(agent);
        vm.expectRevert(); // CooldownActive
        vault.execute(address(allowedTarget), 0, cd);
    }

    // ── Access control ──────────────────────────────────────────────────────────

    function test_NonAgent_Reverts() public {
        bytes memory cd = abi.encodeWithSelector(MockTarget.doSomething.selector, 1);
        vm.prank(hacker);
        vm.expectRevert(PolicyVault.NotAgent.selector);
        vault.execute(address(allowedTarget), 0, cd);
    }

    // ── Policy updates ──────────────────────────────────────────────────────────

    function test_OwnerCanUpdatePolicy() public {
        vm.prank(owner);
        vault.setPolicy(1000e6, 1 hours, 12e17);
        assertEq(vault.maxTxAmount(), 1000e6);
        assertEq(vault.cooldownPeriod(), 1 hours);
        assertEq(vault.healthFactorFloor(), 12e17);
    }

    function test_GetPolicy() public view {
        (address a, bool revoked,,,,,) = vault.getPolicy();
        assertEq(a, agent);
        assertFalse(revoked);
    }

    function test_CooldownRemaining_ZeroWhenReady() public view {
        assertEq(vault.cooldownRemaining(), 0);
    }
}
