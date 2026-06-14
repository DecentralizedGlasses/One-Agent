import { useAccount } from "wagmi";

export function useConnectedWallet() {
  const { address, isConnected, connector } = useAccount();
  return { address, isConnected, connectorName: connector?.name ?? "" };
}
