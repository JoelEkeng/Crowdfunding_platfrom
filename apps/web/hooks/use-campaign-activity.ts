"use client";

import { useQuery } from "@tanstack/react-query";
import { appConfig } from "@/lib/config";

type ApiEvent = {
  event_type: string;
  actor: `0x${string}` | null;
  amount: string | null;
  transaction_hash: string;
  block_number: number;
};

type ApiEventList = {
  items: ApiEvent[];
  total: number;
};

const labels: Record<string, string> = {
  CampaignCreated: "Campaign created",
  RewardTierCreated: "Reward tier added",
  Pledged: "Pledge",
  FundsClaimed: "Creator claim",
  Refunded: "Refund",
};

export function useCampaignActivity(campaignId: bigint) {
  return useQuery({
    queryKey: ["campaign-activity", campaignId.toString()],
    enabled: Boolean(appConfig.isApiConfigured && campaignId > 0n),
    queryFn: async () => {
      if (!appConfig.apiUrl)
        throw new Error("Backend API URL is not configured.");
      const response = await fetch(
        `${appConfig.apiUrl}/api/v1/campaigns/${campaignId}/activity?page_size=100`,
      );
      if (!response.ok)
        throw new Error(`Backend returned HTTP ${response.status}.`);
      const data = (await response.json()) as ApiEventList;
      return data.items.map((event) => ({
        type: labels[event.event_type] ?? event.event_type,
        address: event.actor,
        amount: event.amount === null ? null : BigInt(event.amount),
        hash: event.transaction_hash,
        block: BigInt(event.block_number),
      }));
    },
  });
}
