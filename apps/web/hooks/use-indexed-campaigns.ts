"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { appConfig } from "@/lib/config";
import { CampaignStatus, type Campaign } from "@/lib/types";

type ApiCampaign = {
  campaign_id: string;
  creator: `0x${string}`;
  token: `0x${string}`;
  goal: string;
  deadline: string;
  total_pledged: string;
  total_refunded: string;
  funds_claimed: boolean;
  title: string;
  description: string;
  image_uri: string;
  status: "active" | "successful" | "failed";
};

type ApiIndex = {
  indexed_through_block: number | null;
  safe_head: number | null;
  observed_head: number | null;
  confirmation_depth: number;
  stale: boolean;
  complete: boolean;
  source: "finalized_index";
};

type ApiResponse = {
  items: ApiCampaign[];
  page: number;
  page_size: number;
  total: number;
  index: ApiIndex;
};

const statuses = {
  active: CampaignStatus.Active,
  successful: CampaignStatus.Successful,
  failed: CampaignStatus.Failed,
} as const;

export function mapIndexedCampaign(item: ApiCampaign): Campaign {
  return {
    id: BigInt(item.campaign_id),
    creator: item.creator,
    token: item.token,
    goal: BigInt(item.goal),
    deadline: BigInt(Math.floor(new Date(item.deadline).getTime() / 1000)),
    pledged: BigInt(item.total_pledged),
    refunded: BigInt(item.total_refunded),
    fundsClaimed: item.funds_claimed,
    title: item.title,
    description: item.description,
    imageURI: item.image_uri,
    status: statuses[item.status],
  };
}

export function useIndexedCampaigns(
  options: {
    page?: number;
    pageSize?: number;
    search?: string;
    status?: string;
    sort?: "recent" | "funded" | "deadline";
  } = {},
) {
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 9;
  const query = useQuery({
    queryKey: ["indexed-campaigns", { ...options, page, pageSize }],
    enabled: appConfig.isApiConfigured,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<ApiResponse> => {
      if (!appConfig.apiUrl)
        throw new Error("Backend API URL is not configured.");
      const params = new URLSearchParams({
        page: String(page),
        page_size: String(pageSize),
        sort: options.sort ?? "recent",
      });
      if (options.search?.trim()) params.set("search", options.search.trim());
      if (options.status && options.status !== "all")
        params.set("status", options.status);
      const response = await fetch(
        `${appConfig.apiUrl}/api/v1/campaigns?${params}`,
      );
      if (!response.ok)
        throw new Error(`Backend returned HTTP ${response.status}.`);
      return response.json() as Promise<ApiResponse>;
    },
  });
  const campaigns = (query.data?.items ?? []).map(mapIndexedCampaign);
  const total = query.data?.total ?? 0;
  const configurationError = !appConfig.isApiConfigured
    ? new Error("Backend API URL is not configured.")
    : null;
  return {
    ...query,
    campaigns,
    total,
    totalPages: Math.ceil(total / pageSize),
    index: query.data?.index,
    error: query.error ?? configurationError,
  };
}
