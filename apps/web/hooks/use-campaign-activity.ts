"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { crowdfundingAbi } from "@/lib/abi/crowdfunding";
import { appConfig } from "@/lib/config";

export function useCampaignActivity(campaignId: bigint) {
  const client = usePublicClient({ chainId: appConfig.chainId });
  return useQuery({
    queryKey: ["campaign-activity", campaignId.toString()],
    enabled: Boolean(client && appConfig.isConfigured && campaignId > 0n),
    queryFn: async () => {
      if (!client) return [];
      const [pledges, claims, refunds] = await Promise.all([
        client.getContractEvents({
          address: appConfig.contractAddress,
          abi: crowdfundingAbi,
          eventName: "Pledged",
          args: { campaignId },
          fromBlock: appConfig.deploymentBlock,
          toBlock: "latest",
        }),
        client.getContractEvents({
          address: appConfig.contractAddress,
          abi: crowdfundingAbi,
          eventName: "FundsClaimed",
          args: { campaignId },
          fromBlock: appConfig.deploymentBlock,
          toBlock: "latest",
        }),
        client.getContractEvents({
          address: appConfig.contractAddress,
          abi: crowdfundingAbi,
          eventName: "Refunded",
          args: { campaignId },
          fromBlock: appConfig.deploymentBlock,
          toBlock: "latest",
        }),
      ]);
      return [
        ...pledges.map((event) => ({
          type: "Pledge" as const,
          address: event.args.supporter,
          amount: event.args.amount,
          hash: event.transactionHash,
          block: event.blockNumber,
        })),
        ...claims.map((event) => ({
          type: "Creator claim" as const,
          address: event.args.creator,
          amount: event.args.amount,
          hash: event.transactionHash,
          block: event.blockNumber,
        })),
        ...refunds.map((event) => ({
          type: "Refund" as const,
          address: event.args.supporter,
          amount: event.args.amount,
          hash: event.transactionHash,
          block: event.blockNumber,
        })),
      ].sort((a, b) => Number((b.block ?? 0n) - (a.block ?? 0n)));
    },
  });
}
