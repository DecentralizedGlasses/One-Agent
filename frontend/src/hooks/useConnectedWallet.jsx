import { useDynamicContext } from "@dynamic-labs/sdk-react-core";

export function useConnectedWallet() {
  const { primaryWallet } = useDynamicContext();

  const address = primaryWallet?.address ?? primaryWallet?.id ?? null;
  const connectorName =
    primaryWallet?.connector?.name || primaryWallet?.name || "Unknown wallet";
  const isConnected = Boolean(address);

  return {
    primaryWallet,
    address,
    connectorName,
    isConnected,
  };
}
