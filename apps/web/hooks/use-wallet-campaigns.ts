"use client";

import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import type { Address } from "viem";
import { crowdfundingAbi } from "@/lib/abi/crowdfunding";
import { appConfig } from "@/lib/config";

export function useWalletCampaignIds(address?: Address) {
  const client = usePublicClient({ chainId: appConfig.chainId });
  return useQuery({
    queryKey: ["wallet-campaign-ids", address],
    enabled: Boolean(address && client && appConfig.isConfigured),
    queryFn: async () => {
      if (!client || !address) return { created: [], contributed: [] };
      const [created, contributed] = await Promise.all([
        client.getContractEvents({
          address: appConfig.contractAddress,
          abi: crowdfundingAbi,
          eventName: "CampaignCreated",
          args: { creator: address },
          fromBlock: appConfig.deploymentBlock,
          toBlock: "latest",
        }),
        client.getContractEvents({
          address: appConfig.contractAddress,
          abi: crowdfundingAbi,
          eventName: "Pledged",
          args: { supporter: address },
          fromBlock: appConfig.deploymentBlock,
          toBlock: "latest",
        }),
      ]);
      return {
        created: [
          ...new Set(
            created
              .map((event) => event.args.campaignId)
              .filter((id): id is bigint => id !== undefined),
          ),
        ],
        contributed: [
          ...new Set(
            contributed
              .map((event) => event.args.campaignId)
              .filter((id): id is bigint => id !== undefined),
          ),
        ],
      };
    },
  });
}
