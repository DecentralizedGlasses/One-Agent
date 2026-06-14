import { parseAbi } from "viem";

export const VAULT_ADDRESS = import.meta.env.VITE_VAULT_ADDRESS;
export const AAVE_POOL     = "0x8bAB6d1b75f19e9eD9fCe8b9BD338844fF79aE27"; // Base Sepolia

export const VAULT_ABI = parseAbi([
  "function getPolicy() external view returns (address, bool, uint256, uint256, uint256, uint256, address[])",
  "function getHealthFactor() external view returns (uint256)",
  "function cooldownRemaining() external view returns (uint256)",
  "function emergencyRevoke() external",
  "function reinstateAgent() external",
  "function setPolicy(uint256,uint256,uint256,int256) external",
  "function setAllowedProtocols(address[]) external",
  "event ExecutionAllowed(address indexed agent, address indexed target, uint256 amount)",
  "event ExecutionBlocked(address indexed agent, address indexed target, string reason)",
  "event AgentRevoked(address indexed owner, address indexed agent)",
  "event AgentReinstated(address indexed owner, address indexed agent)",
]);
