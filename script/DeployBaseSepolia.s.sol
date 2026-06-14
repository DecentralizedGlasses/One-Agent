// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/PolicyVault.sol";

contract DeployBaseSepolia is Script {
    address constant AAVE_POOL    = 0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27;
    address constant USDC         = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant ETH_USD_FEED = 0x4aDC67696bA383F43DD60A9e78F2C97Fbbfc7cb1;

    function run() external {
        uint256 pk           = vm.envUint("PRIVATE_KEY");
        address agentAddress = vm.addr(pk); // agent = same wallet as deployer/owner

        address[] memory protocols = new address[](1);
        protocols[0] = AAVE_POOL;

        address[] memory tracked = new address[](1);
        tracked[0] = USDC;

        vm.startBroadcast(pk);

        PolicyVault vault = new PolicyVault(
            agentAddress,
            500e6,       // 500 USDC max per tx
            30 minutes,  // 30-minute cooldown
            15e17,       // Aave health factor floor: 1.5
            1500e8,      // Chainlink price floor: $1500 ETH/USD
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
