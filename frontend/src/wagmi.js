import { parseAbi } from "viem";
import { baseSepolia } from "wagmi/chains";

export const VAULT_ADDRESS  = import.meta.env.VITE_VAULT_ADDRESS;
export const VAULT_CHAIN_ID = baseSepolia.id;
export const USDC_ADDRESS   = "0xba50Cd2A20f6DA35D788639E581bca8d0B5d4D5f"; // USDC in this Aave V3 pool on Base Sepolia

export const VAULT_ABI = parseAbi([
  "function getPolicy() external view returns (address, bool, uint256, uint256, uint256, int256, uint256, address[])",
  "function getHealthFactor() external view returns (uint256)",
  "function cooldownRemaining() external view returns (uint256)",
  "function emergencyRevoke() external",
  "function reinstateAgent() external",
  "function setPolicy(uint256,uint256,uint256,int256) external",
  "function setAllowedProtocols(address[]) external",
  "function getAllowedProtocols() external view returns (address[])",
  "function getTokenBalance(address) external view returns (uint256)",
  "event ExecutionAllowed(address indexed agent, address indexed target, uint256 amount)",
  "event ExecutionBlocked(address indexed agent, address indexed target, string reason)",
  "event AgentRevoked(address indexed owner, address indexed agent)",
  "event AgentReinstated(address indexed owner, address indexed agent)",
]);
