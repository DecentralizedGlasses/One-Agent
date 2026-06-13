import { parseAbi } from "viem";

export const VAULT_ADDRESS = import.meta.env.VITE_VAULT_ADDRESS;
export const AAVE_POOL     = "0x07eA79F68B2B3df564D0A34F8e19D9B1e339814";

export const VAULT_ABI = parseAbi([
  "function getPolicy() external view returns (address, bool, uint256, uint256, uint256, uint256, address[])",
  "function getHealthFactor() external view returns (uint256)",
  "function cooldownRemaining() external view returns (uint256)",
  "function emergencyRevoke() external",
  "function reinstateAgent() external",
  "function setPolicy(uint256,uint256,uint256) external",
  "function setAllowedProtocols(address[]) external",
  "event ExecutionAllowed(address indexed agent, address indexed target, uint256 amount)",
  "event ExecutionBlocked(address indexed agent, address indexed target, string reason)",
  "event AgentRevoked(address indexed owner, address indexed agent)",
  "event AgentReinstated(address indexed owner, address indexed agent)",
]);
