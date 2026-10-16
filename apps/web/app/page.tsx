"use client";

import { ArrowRight, ShieldCheck, Sparkles, Waypoints } from "lucide-react";
import Link from "next/link";
import { useIndexedCampaigns } from "@/hooks/use-indexed-campaigns";
import { CampaignGrid } from "@/components/campaigns/campaign-grid";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function HomePage() {
  const { campaigns, isLoading, error } = useIndexedCampaigns({
    page: 1,
    pageSize: 6,
    sort: "funded",
  });
  const featured = [...campaigns]
    .sort((a, b) => (a.pledged > b.pledged ? -1 : 1))
    .slice(0, 3);
  return (
    <>
      <section className="mx-auto grid min-h-[72vh] max-w-7xl items-center gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-lime-300/20 bg-lime-300/8 px-4 py-2 text-sm text-lime-200">
            <Sparkles size={16} />
            Transparent funding, deterministic settlement
          </div>
          <h1 className="max-w-4xl text-5xl font-bold tracking-[-.04em] sm:text-6xl lg:text-7xl">
            Ideas deserve funding rules everyone can verify.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-400">
            FundChain is ERC-20 crowdfunding without a custodial administrator.
            Goals, deadlines, creator claims, and supporter refunds are enforced
            by the smart contract.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/campaigns">
                Explore campaigns <ArrowRight size={18} />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/campaigns/create">Launch a campaign</Link>
            </Button>
          </div>
        </div>
        <Card className="relative overflow-hidden p-7">
          <div className="absolute -top-20 -right-20 size-64 rounded-full bg-lime-300/10 blur-3xl" />
          <p className="text-sm font-semibold text-lime-300">HOW IT SETTLES</p>
          <div className="mt-7 space-y-7">
            {[
              {
                icon: Waypoints,
                n: "01",
                title: "Launch immutable terms",
                text: "Choose a vetted token, goal, tiers, and deadline.",
              },
              {
                icon: ShieldCheck,
                n: "02",
                title: "Pledge into escrow",
                text: "Approvals and contributions execute directly through your wallet.",
              },
              {
                icon: Sparkles,
                n: "03",
                title: "Settle by outcome",
                text: "Creators claim successful funding; supporters refund failed campaigns.",
              },
            ].map(({ icon: Icon, n, title, text }) => (
              <div key={n} className="flex gap-4">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/5 text-lime-300">
                  <Icon />
                </span>
                <div>
                  <p className="text-xs text-slate-500">{n}</p>
                  <h2 className="font-semibold">{title}</h2>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    {text}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </section>
      <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold text-lime-300">ON-CHAIN NOW</p>
            <h2 className="mt-2 text-3xl font-bold">Featured campaigns</h2>
          </div>
          <Link
            href="/campaigns"
            className="text-sm text-slate-300 hover:text-lime-300"
          >
            View all →
          </Link>
        </div>
        <CampaignGrid
          campaigns={featured}
          isLoading={isLoading}
          error={error}
        />
      </section>
    </>
  );
}
