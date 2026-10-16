"use client";

import { useMemo } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { crowdfundingAbi } from "@/lib/abi/crowdfunding";
import { appConfig } from "@/lib/config";
import { CampaignStatus, type Campaign } from "@/lib/types";

export function useCampaignCount() {
  return useReadContract({
    address: appConfig.contractAddress,
    abi: crowdfundingAbi,
    functionName: "campaignCount",
    chainId: appConfig.chainId,
    query: { enabled: appConfig.isConfigured },
  });
}

export function useCampaigns(page = 1, pageSize = 9) {
  const countQuery = useCampaignCount();
  const total = Number(countQuery.data ?? 0n);
  const ids = useMemo(() => {
    const end = Math.max(total - (page - 1) * pageSize, 0);
    const start = Math.max(end - pageSize + 1, 1);
    return Array.from({ length: Math.max(end - start + 1, 0) }, (_, index) =>
      BigInt(end - index),
    );
  }, [page, pageSize, total]);
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
  ]);
  const reads = useReadContracts({
    contracts,
    query: { enabled: appConfig.isConfigured && ids.length > 0 },
  });
  const campaigns = useMemo(
    () =>
      ids.flatMap((id, index) => {
        const campaignResult = reads.data?.[index * 2];
        const statusResult = reads.data?.[index * 2 + 1];
        if (
          campaignResult?.status !== "success" ||
          statusResult?.status !== "success"
        )
          return [];
        const value = campaignResult.result;
        if (typeof value !== "object" || !("creator" in value)) return [];
        return [
          {
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
        ];
      }),
    [ids, reads.data],
  );
  return {
    campaigns,
    total,
    totalPages: Math.ceil(total / pageSize),
    isLoading: countQuery.isLoading || reads.isLoading,
    error: countQuery.error ?? reads.error,
    refetch: async () => {
      await Promise.all([countQuery.refetch(), reads.refetch()]);
    },
  };
}
