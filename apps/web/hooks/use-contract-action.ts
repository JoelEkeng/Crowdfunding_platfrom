"use client";

import { useCallback, useState } from "react";
import {
  useAccount,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import type { Abi, Address } from "viem";
import { appConfig } from "@/lib/config";
import type { TxState } from "@/lib/types";
import { friendlyError } from "@/lib/utils";

export function useContractAction(
  onConfirmed?: () => unknown | Promise<unknown>,
) {
  const { address, chainId } = useAccount();
  const client = usePublicClient({ chainId: appConfig.chainId });
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [state, setState] = useState<TxState>({ phase: "idle" });

  const execute = useCallback(
    async (request: {
      address: Address;
      abi: Abi;
      functionName: string;
      args?: readonly unknown[];
    }) => {
      if (!address) {
        setState({
          phase: "reverted",
          message: "Connect a wallet to continue.",
        });
        return;
      }
      try {
        if (chainId !== appConfig.chainId)
          await switchChainAsync({ chainId: appConfig.chainId });
        setState({
          phase: "awaiting-signature",
          message: "Confirm this request in your wallet.",
        });
        const hash = await writeContractAsync({
          ...request,
          chainId: appConfig.chainId,
          account: address,
        } as Parameters<typeof writeContractAsync>[0]);
        setState({
          phase: "pending",
          hash,
          message: "Transaction submitted. Waiting for confirmation.",
        });
        if (!client)
          throw new Error("RPC client is unavailable after submission.");
        try {
          const receipt = await client.waitForTransactionReceipt({ hash });
          if (receipt.status === "reverted") {
            setState({
              phase: "reverted",
              hash,
              message: "The transaction reverted on-chain.",
            });
            return;
          }
          setState({
            phase: "confirmed",
            hash,
            message: "Confirmed on-chain.",
          });
          await onConfirmed?.();
        } catch (error) {
          setState({
            phase: "uncertain",
            hash,
            message: `Confirmation could not be verified: ${friendlyError(error)}`,
          });
        }
      } catch (error) {
        setState({ phase: "reverted", message: friendlyError(error) });
      }
    },
    [
      address,
      chainId,
      client,
      onConfirmed,
      switchChainAsync,
      writeContractAsync,
    ],
  );

  return { state, execute, reset: () => setState({ phase: "idle" }) };
}
