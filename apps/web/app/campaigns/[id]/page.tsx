"use client";

import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount } from "wagmi";
import { CampaignStatus } from "@/lib/types";
import { appConfig, explorerAddressUrl, explorerTxUrl } from "@/lib/config";
import {
  deadlineLabel,
  formatToken,
  fundingPercent,
  shortAddress,
  statusLabel,
} from "@/lib/utils";
import { useCampaign } from "@/hooks/use-campaign";
import { useCampaignActivity } from "@/hooks/use-campaign-activity";
import { ContributionPanel } from "@/components/campaigns/contribution-panel";
import { SettlementPanel } from "@/components/campaigns/settlement-panel";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const id = /^\d+$/.test(params.id) ? BigInt(params.id) : 0n;
  const { address } = useAccount();
  const query = useCampaign(id, address);
  const activity = useCampaignActivity(id);
  if (query.isLoading)
    return (
      <div className="mx-auto max-w-7xl px-4 py-14">
        <Skeleton className="h-160" />
      </div>
    );
  if (query.error)
    return (
      <div className="mx-auto max-w-7xl px-4 py-14">
        <ErrorState message={query.error.message} />
      </div>
    );
  if (!query.campaign)
    return (
      <div className="mx-auto max-w-7xl px-4 py-14">
        <EmptyState
          title="Campaign not found"
          message="This ID does not exist on the configured FundChain deployment."
        />
      </div>
    );
  const campaign = query.campaign;
  const progress = fundingPercent(campaign.pledged, campaign.goal);
  const creatorUrl = explorerAddressUrl(campaign.creator);
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <Link
        href="/campaigns"
        className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white"
      >
        <ArrowLeft size={16} />
        Back to discovery
      </Link>
      <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_23rem]">
        <div>
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-950 via-slate-900 to-lime-950">
            {campaign.imageURI ? (
              <div
                role="img"
                aria-label={`${campaign.title} campaign image`}
                className="h-80 w-full bg-cover bg-center sm:h-112"
                style={{ backgroundImage: `url(${campaign.imageURI})` }}
              />
            ) : (
              <div className="grid h-80 place-items-center text-slate-600 sm:h-112">
                <ShieldCheck size={60} />
              </div>
            )}
          </div>
          <div className="mt-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-lime-300/10 px-3 py-1 text-sm font-semibold text-lime-200">
                {statusLabel(campaign.status, campaign.fundsClaimed)}
              </span>
              <span className="text-sm text-slate-500">
                Campaign #{campaign.id.toString()}
              </span>
            </div>
            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">
              {campaign.title}
            </h1>
            <a
              href={creatorUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-lime-300"
            >
              Created by {shortAddress(campaign.creator, 6)}{" "}
              <ExternalLink size={14} />
            </a>
            <p className="mt-8 text-lg leading-8 whitespace-pre-wrap text-slate-300">
              {campaign.description || "No campaign description was provided."}
            </p>
          </div>
          <section className="mt-12">
            <h2 className="text-2xl font-semibold">Public activity</h2>
            <p className="mt-2 text-sm text-slate-500">
              Events from the configured deployment block. Recent entries may
              change during a chain reorganization.
            </p>
            <div className="mt-5 space-y-3">
              {activity.isLoading ? (
                <Skeleton className="h-28" />
              ) : activity.isError ? (
                <ErrorState message={activity.error.message} />
              ) : !activity.data?.length ? (
                <EmptyState
                  title="No activity yet"
                  message="Confirmed pledges and settlements will appear here."
                />
              ) : (
                activity.data.slice(0, 20).map((item, index) => (
                  <Card
                    key={`${item.hash}-${index}`}
                    className="flex items-center justify-between gap-4 p-4"
                  >
                    <div>
                      <p className="font-semibold">{item.type}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {item.address
                          ? shortAddress(item.address)
                          : "Unknown address"}{" "}
                        ·{" "}
                        {formatToken(
                          item.amount ?? 0n,
                          appConfig.supportedToken.decimals,
                        )}{" "}
                        {appConfig.supportedToken.symbol}
                      </p>
                    </div>
                    {item.hash && (
                      <a
                        href={explorerTxUrl(item.hash)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="View transaction"
                      >
                        <ExternalLink size={17} />
                      </a>
                    )}
                  </Card>
                ))
              )}
            </div>
          </section>
        </div>
        <aside className="space-y-5">
          <Card className="p-6">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-3xl font-bold">
                  {formatToken(
                    campaign.pledged,
                    appConfig.supportedToken.decimals,
                  )}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  of{" "}
                  {formatToken(
                    campaign.goal,
                    appConfig.supportedToken.decimals,
                  )}{" "}
                  {appConfig.supportedToken.symbol}
                </p>
              </div>
              <p className="text-xl font-semibold text-lime-300">
                {progress.toFixed(0)}%
              </p>
            </div>
            <Progress value={progress} className="mt-5" />
            <div className="mt-5 flex justify-between text-sm">
              <span className="text-slate-500">Deadline</span>
              <span>{deadlineLabel(campaign.deadline)}</span>
            </div>
          </Card>
          {campaign.status === CampaignStatus.Active && (
            <ContributionPanel
              campaign={campaign}
              tiers={query.tiers}
              onConfirmed={query.refetch}
            />
          )}
          <SettlementPanel
            campaign={campaign}
            pledgedByUser={query.pledgedByUser}
            onConfirmed={query.refetch}
          />
        </aside>
      </div>
    </div>
  );
}
