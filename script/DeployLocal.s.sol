// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/PolicyVault.sol";

// Local Anvil deploy — uses address(0) for Aave and Chainlink
// so all external checks are skipped and execute() works immediately
contract DeployLocal is Script {
    function run() external {
        address agentAddress = vm.envAddress("AGENT_ADDRESS");
        uint256 pk = vm.envUint("PRIVATE_KEY");

        address[] memory protocols = new address[](1);
        protocols[0] = address(0x1); // dummy whitelisted target for local demo

        address[] memory tracked = new address[](0); // no token tracking locally

        vm.startBroadcast(pk);

        PolicyVault vault = new PolicyVault(
            agentAddress,
            500e6,       // 500 USDC max per tx
            30 minutes,  // cooldown
            15e17,       // health factor floor 1.5
            1500e8,      // Chainlink price floor $1500
            protocols,
            tracked,
            address(0),  // skip Aave health factor check
            address(0)   // skip Chainlink price check
        );

        vm.stopBroadcast();

        console.log("PolicyVault:", address(vault));
        console.log("Owner:      ", vault.owner());
        console.log("Agent:      ", vault.agent());
    }
}
