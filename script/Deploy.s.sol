// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/PolicyVault.sol";

contract DeployPolicyVault is Script {
    // Aave v3 Pool on Base Sepolia
    address constant AAVE_POOL = 0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951;

    // USDC on Base Sepolia — tracked for balance snapshots
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    // Chainlink ETH/USD feed on Base Sepolia
    address constant ETH_USD_FEED = 0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1;

    function run() external {
        address agentAddress = vm.envAddress("AGENT_ADDRESS");
        uint256 pk = vm.envUint("PRIVATE_KEY");

        // Whitelist: only the Aave pool is allowed
        address[] memory protocols = new address[](1);
        protocols[0] = AAVE_POOL;

        // Track USDC balance after every agent action
        address[] memory tracked = new address[](1);
        tracked[0] = USDC;

        vm.startBroadcast(pk);

        PolicyVault vault = new PolicyVault(
            agentAddress,
            500e6,        // 500 USDC max per tx
            30 minutes,   // 30-minute cooldown between actions
            15e17,        // Aave health factor floor: 1.5
            1500e8,       // Chainlink price floor: $1500 ETH/USD (8 decimals)
            protocols,
            tracked,
            AAVE_POOL,
            ETH_USD_FEED  // Chainlink ETH/USD feed
        );

        vm.stopBroadcast();

        console.log("PolicyVault:", address(vault));
        console.log("Owner:      ", vault.owner());
        console.log("Agent:      ", vault.agent());
    }
}
