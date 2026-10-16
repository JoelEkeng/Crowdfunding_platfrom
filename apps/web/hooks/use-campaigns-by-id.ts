"use client";

import { useReadContracts } from "wagmi";
import { crowdfundingAbi } from "@/lib/abi/crowdfunding";
import { appConfig } from "@/lib/config";
import { CampaignStatus, type Campaign } from "@/lib/types";
import type { Address } from "viem";

export function useCampaignsById(ids: bigint[], account?: Address) {
  const contracts = ids.flatMap((id) => [
    {
      address: appConfig.contractAddress,
      abi: crowdfundingAbi,
      functionName: "getCampaign" as const,
      args: [id] as const,
      chainId: appConfig.chainId,
    },
    {
      address: appConfig.contractAddress,
      abi: crowdfundingAbi,
      functionName: "status" as const,
      args: [id] as const,
      chainId: appConfig.chainId,
    },
    {
      address: appConfig.contractAddress,
      abi: crowdfundingAbi,
      functionName: "pledgedBy" as const,
      args: [id, account ?? appConfig.contractAddress] as const,
      chainId: appConfig.chainId,
    },
  ]);
  const query = useReadContracts({
    contracts,
    query: { enabled: ids.length > 0 && appConfig.isConfigured },
  });
  const campaigns = ids.flatMap((id, index) => {
    const campaignResult = query.data?.[index * 3];
    const statusResult = query.data?.[index * 3 + 1];
    const pledgeResult = query.data?.[index * 3 + 2];
    if (
      campaignResult?.status !== "success" ||
      statusResult?.status !== "success"
    )
      return [];
    const value = campaignResult.result;
    if (typeof value !== "object" || !("creator" in value)) return [];
    return [
      {
        campaign: {
          id,
          creator: value.creator,
          token: value.token,
          goal: value.goal,
          deadline: value.deadline,
          pledged: value.pledged,
          refunded: value.refunded,
          fundsClaimed: value.fundsClaimed,
          title: value.title,
          description: value.description,
          imageURI: value.imageURI,
          status: Number(statusResult.result) as CampaignStatus,
        } satisfies Campaign,
        pledgedByUser:
          pledgeResult?.status === "success"
            ? (pledgeResult.result as bigint)
            : 0n,
      },
    ];
  });
  return { ...query, campaigns };
}
