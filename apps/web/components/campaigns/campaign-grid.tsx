"use client";

import { CampaignCard } from "./campaign-card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import type { Campaign } from "@/lib/types";

export function CampaignGrid({
  campaigns,
  isLoading,
  error,
}: {
  campaigns: Campaign[];
  isLoading?: boolean;
  error?: Error | null;
}) {
  if (isLoading)
    return (
      <div
        aria-label="Loading campaigns"
        className="grid gap-5 md:grid-cols-2 lg:grid-cols-3"
      >
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-112" />
        ))}
      </div>
    );
  if (error) return <ErrorState message={error.message} />;
  if (!campaigns.length)
    return (
      <EmptyState
        title="No campaigns found"
        message="Try another filter, or become the first creator to launch a campaign."
      />
    );
  return (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {campaigns.map((campaign) => (
        <CampaignCard key={campaign.id.toString()} campaign={campaign} />
      ))}
    </div>
  );
}
