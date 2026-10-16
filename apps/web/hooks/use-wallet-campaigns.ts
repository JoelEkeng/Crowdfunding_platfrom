"use client";

import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { appConfig } from "@/lib/config";

type ApiUserActivity = {
  address: string;
  created: { campaign_id: string }[];
  contributed: { campaign: { campaign_id: string } }[];
};

export function useWalletCampaignIds(address?: Address) {
  return useQuery({
    queryKey: ["wallet-campaign-ids", address],
    enabled: Boolean(address && appConfig.isApiConfigured),
    queryFn: async () => {
      if (!address) return { created: [], contributed: [] };
      if (!appConfig.apiUrl)
        throw new Error("Backend API URL is not configured.");
      const response = await fetch(
        `${appConfig.apiUrl}/api/v1/users/${address}/activity`,
      );
      if (!response.ok)
        throw new Error(`Backend returned HTTP ${response.status}.`);
      const data = (await response.json()) as ApiUserActivity;
      return {
        created: data.created.map((item) => BigInt(item.campaign_id)),
        contributed: data.contributed.map((item) =>
          BigInt(item.campaign.campaign_id),
        ),
      };
    },
  });
}
