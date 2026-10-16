import { ArrowUpRight, Clock3 } from "lucide-react";
import Link from "next/link";
import { appConfig } from "@/lib/config";
import type { Campaign } from "@/lib/types";
import {
  deadlineLabel,
  formatToken,
  fundingPercent,
  shortAddress,
  statusLabel,
} from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const progress = fundingPercent(campaign.pledged, campaign.goal);
  return (
    <Card className="group relative overflow-hidden transition hover:-translate-y-1 hover:border-lime-300/30">
      <div className="relative h-48 overflow-hidden bg-gradient-to-br from-emerald-900 via-slate-900 to-lime-900">
        {campaign.imageURI && (
          <div
            aria-hidden
            className="h-full w-full bg-cover bg-center opacity-80 transition duration-500 group-hover:scale-105"
            style={{ backgroundImage: `url(${campaign.imageURI})` }}
          />
        )}
        <span className="absolute top-4 left-4 rounded-full border border-white/15 bg-slate-950/70 px-3 py-1 text-xs font-semibold backdrop-blur">
          {statusLabel(campaign.status, campaign.fundsClaimed)}
        </span>
      </div>
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium text-lime-300">
              Campaign #{campaign.id.toString()}
            </p>
            <h3 className="mt-1 line-clamp-2 text-xl font-semibold">
              {campaign.title}
            </h3>
          </div>
          <ArrowUpRight className="shrink-0 text-slate-500 transition group-hover:text-lime-300" />
        </div>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-400">
          {campaign.description || "No description provided."}
        </p>
        <div className="mt-5">
          <div className="mb-2 flex justify-between text-sm">
            <span className="font-semibold">
              {formatToken(campaign.pledged, appConfig.supportedToken.decimals)}{" "}
              {appConfig.supportedToken.symbol}
            </span>
            <span className="text-slate-400">{progress.toFixed(0)}%</span>
          </div>
          <Progress value={progress} />
          <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
            <span>
              Goal{" "}
              {formatToken(campaign.goal, appConfig.supportedToken.decimals)}{" "}
              {appConfig.supportedToken.symbol}
            </span>
            <span className="flex items-center gap-1">
              <Clock3 size={13} />
              {deadlineLabel(campaign.deadline)}
            </span>
          </div>
        </div>
        <div className="mt-5 border-t border-white/8 pt-4 text-xs text-slate-500">
          By {shortAddress(campaign.creator)}
        </div>
        <Link href={`/campaigns/${campaign.id}`} className="absolute inset-0">
          <span className="sr-only">View {campaign.title}</span>
        </Link>
      </div>
    </Card>
  );
}
