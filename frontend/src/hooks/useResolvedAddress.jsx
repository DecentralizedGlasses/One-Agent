import { useEffect, useState } from "react";
import { createPublicClient, getAddress, http, isAddress } from "viem";
import { mainnet } from "viem/chains";

const ensClient = createPublicClient({
  chain: mainnet,
  transport: http(),
});

export function useResolvedAddress(addressOrEns) {
  const [resolvedAddress, setResolvedAddress] = useState(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");

  useEffect(() => {
    let cancelled = false;
    const value = addressOrEns?.trim();

    async function resolve() {
      setResolveError("");

      if (!value) {
        setResolvedAddress(null);
        setIsResolving(false);
        return;
      }

      if (isAddress(value)) {
        setResolvedAddress(getAddress(value));
        setIsResolving(false);
        return;
      }

      setIsResolving(true);
      try {
        const address = await ensClient.getEnsAddress({ name: value });
        if (cancelled) return;

        if (!address) {
          setResolvedAddress(null);
          setResolveError(`Could not resolve ENS name: ${value}`);
          return;
        }

        setResolvedAddress(getAddress(address));
      } catch (err) {
        if (cancelled) return;
        setResolvedAddress(null);
        setResolveError(err.message || `Could not resolve ENS name: ${value}`);
      } finally {
        if (!cancelled) setIsResolving(false);
      }
    }

    resolve();
    return () => {
      cancelled = true;
    };
  }, [addressOrEns]);

  return { resolvedAddress, isResolving, resolveError };
}
