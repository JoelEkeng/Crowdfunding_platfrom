"use client";

import { useReadContracts } from "wagmi";
import type { Address } from "viem";
import { crowdfundingAbi } from "@/lib/abi/crowdfunding";
import { appConfig } from "@/lib/config";
import { CampaignStatus, type Campaign, type RewardTier } from "@/lib/types";

export function useCampaign(id: bigint, account?: Address) {
  const query = useReadContracts({
    contracts: [
      {
        address: appConfig.contractAddress,
        abi: crowdfundingAbi,
        functionName: "getCampaign",
        args: [id],
        chainId: appConfig.chainId,
      },
      {
        address: appConfig.contractAddress,
        abi: crowdfundingAbi,
        functionName: "status",
        args: [id],
        chainId: appConfig.chainId,
      },
      {
        address: appConfig.contractAddress,
        abi: crowdfundingAbi,
        functionName: "getRewardTiers",
        args: [id],
        chainId: appConfig.chainId,
      },
      {
        address: appConfig.contractAddress,
        abi: crowdfundingAbi,
        functionName: "pledgedBy",
        args: [id, account ?? appConfig.contractAddress],
        chainId: appConfig.chainId,
      },
    ],
    query: { enabled: appConfig.isConfigured && id > 0n },
  });
  const [campaignResult, statusResult, tiersResult, pledgedResult] =
    query.data ?? [];
  let campaign: Campaign | undefined;
  if (
    campaignResult?.status === "success" &&
    statusResult?.status === "success"
  ) {
    const value = campaignResult.result;
    campaign = {
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
    };
  }
  return {
    ...query,
    campaign,
    tiers:
      tiersResult?.status === "success"
        ? (tiersResult.result as readonly RewardTier[])
        : [],
    pledgedByUser:
      pledgedResult?.status === "success"
        ? (pledgedResult.result as bigint)
        : 0n,
  };
}
