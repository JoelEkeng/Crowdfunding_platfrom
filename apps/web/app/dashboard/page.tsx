"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { ExternalLink, WalletCards } from "lucide-react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { CampaignStatus } from "@/lib/types";
import { appConfig } from "@/lib/config";
import {
  canClaimFunds,
  canClaimRefund,
  formatToken,
  statusLabel,
} from "@/lib/utils";
import { useCampaignsById } from "@/hooks/use-campaigns-by-id";
import { useWalletCampaignIds } from "@/hooks/use-wallet-campaigns";
import { Card } from "@/components/ui/card";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { Skeleton } from "@/components/ui/skeleton";

function CampaignRows({
  rows,
  account,
  kind,
}: {
  rows: ReturnType<typeof useCampaignsById>["campaigns"];
  account: `0x${string}`;
  kind: "created" | "contributed";
}) {
  if (!rows.length)
    return (
      <EmptyState
        title={
          kind === "created" ? "No campaigns created" : "No contributions found"
        }
        message={
          kind === "created"
            ? "Launch a campaign and it will appear here after confirmation."
            : "Confirmed pledge events for this wallet will appear here."
        }
      />
    );
  return (
    <div className="space-y-3">
      {rows.map(({ campaign, pledgedByUser }) => (
        <Card
          key={campaign.id.toString()}
          className="flex flex-col justify-between gap-5 p-5 sm:flex-row sm:items-center"
        >
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold">{campaign.title}</h3>
              <span className="rounded-full bg-white/6 px-2 py-1 text-xs text-slate-300">
                {statusLabel(campaign.status, campaign.fundsClaimed)}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-500">
              {kind === "created"
                ? `${formatToken(campaign.pledged, appConfig.supportedToken.decimals)} ${appConfig.supportedToken.symbol} pledged`
                : `${formatToken(pledgedByUser, appConfig.supportedToken.decimals)} ${appConfig.supportedToken.symbol} contributed`}
            </p>
            {canClaimFunds(campaign, account) && (
              <p className="mt-2 text-sm font-medium text-lime-300">
                Creator funds are claimable
              </p>
            )}
            {canClaimRefund(campaign, pledgedByUser) && (
              <p className="mt-2 text-sm font-medium text-lime-300">
                Refund is claimable
              </p>
            )}
            {campaign.status === CampaignStatus.Active && (
              <p className="mt-2 text-xs text-slate-600">
                Settlement becomes available after the deadline.
              </p>
            )}
          </div>
          <Link
            href={`/campaigns/${campaign.id}`}
            className="inline-flex items-center gap-2 text-sm text-lime-300"
          >
            Open campaign <ExternalLink size={15} />
          </Link>
        </Card>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { address, isConnected, chainId } = useAccount();
  const ids = useWalletCampaignIds(address);
  const created = useCampaignsById(ids.data?.created ?? [], address);
  const contributed = useCampaignsById(ids.data?.contributed ?? [], address);
  if (!isConnected || !address)
    return (
      <div className="mx-auto min-h-[70vh] max-w-4xl px-4 py-16">
        <Card className="grid min-h-96 place-items-center p-8 text-center">
          <div>
            <WalletCards className="mx-auto text-lime-300" size={42} />
            <h1 className="mt-5 text-3xl font-bold">Connect your wallet</h1>
            <p className="mx-auto mt-3 max-w-md text-slate-400">
              Your dashboard is assembled from campaign and pledge events for
              the connected address.
            </p>
            <div className="mt-7">
              <ConnectButton />
            </div>
          </div>
        </Card>
      </div>
    );
  const loading = ids.isLoading || created.isLoading || contributed.isLoading;
  const error = ids.error ?? created.error ?? contributed.error;
  return (
    <div className="mx-auto min-h-[75vh] max-w-6xl px-4 py-14 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-semibold text-lime-300">
            YOUR ON-CHAIN ACTIVITY
          </p>
          <h1 className="mt-2 text-4xl font-bold">Dashboard</h1>
          <p className="mt-3 text-sm text-slate-500">
            Connected as {address.slice(0, 8)}…{address.slice(-6)}
          </p>
        </div>
        {chainId !== appConfig.chainId && (
          <span
            role="alert"
            className="rounded-full bg-amber-300/10 px-4 py-2 text-sm text-amber-200"
          >
            Wrong network
          </span>
        )}
      </div>
      {loading ? (
        <div className="mt-10 space-y-4">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      ) : error ? (
        <div className="mt-10">
          <ErrorState message={error.message} />
        </div>
      ) : (
        <div className="mt-12 space-y-14">
          <section>
            <h2 className="mb-5 text-2xl font-semibold">
              Campaigns you created
            </h2>
            <CampaignRows
              rows={created.campaigns}
              account={address}
              kind="created"
            />
          </section>
          <section>
            <h2 className="mb-5 text-2xl font-semibold">
              Contributions & refunds
            </h2>
            <CampaignRows
              rows={contributed.campaigns}
              account={address}
              kind="contributed"
            />
          </section>
          <section>
            <h2 className="mb-2 text-2xl font-semibold">Transaction history</h2>
            <p className="text-sm text-slate-500">
              Each campaign page lists confirmed pledge, claim, and refund logs
              with explorer links. Pending wallet requests are intentionally not
              treated as history.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
