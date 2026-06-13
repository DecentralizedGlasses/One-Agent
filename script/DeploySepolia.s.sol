// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/PolicyVault.sol";

contract DeploySepolia is Script {
    // Aave v3 Pool on Ethereum Sepolia
    address constant AAVE_POOL    = 0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951;

    // Aave testnet USDC on Ethereum Sepolia
    address constant USDC         = 0x94a9D9AC8a22534E3FaCa9F4e7F2E2cf85d5E4C8;

    // Chainlink ETH/USD feed on Ethereum Sepolia
    address constant ETH_USD_FEED = 0x694AA1769357215DE4FAC081bf1f309aDC325306;

    function run() external {
        address agentAddress = vm.envAddress("AGENT_ADDRESS");
        uint256 pk           = vm.envUint("PRIVATE_KEY");

        address[] memory protocols = new address[](1);
        protocols[0] = AAVE_POOL;

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
            ETH_USD_FEED
        );

        vm.stopBroadcast();

        console.log("PolicyVault:", address(vault));
        console.log("Owner:      ", vault.owner());
        console.log("Agent:      ", vault.agent());
    }
}
