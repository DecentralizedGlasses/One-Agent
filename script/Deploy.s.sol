// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../src/PolicyVault.sol";

contract DeployPolicyVault is Script {
    // Base Sepolia — Aave v3 Pool
    address constant AAVE_POOL = 0x07eA79F68B2B3df564D0A34F8e19D9B1e339814;

    function run() external {
        address agentAddress = vm.envAddress("AGENT_ADDRESS");
        uint256 pk = vm.envUint("PRIVATE_KEY");

        address[] memory protocols = new address[](1);
        protocols[0] = AAVE_POOL;

        vm.startBroadcast(pk);

        PolicyVault vault = new PolicyVault(
            agentAddress,
            500e6,       // 500 USDC max per tx
            30 minutes,  // cooldown
            15e17,       // 1.5 health factor floor
            protocols,
            AAVE_POOL
        );

        vm.stopBroadcast();

        console.log("PolicyVault:", address(vault));
        console.log("Owner:      ", vault.owner());
        console.log("Agent:      ", vault.agent());
    }
}
