"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { CampaignGrid } from "@/components/campaigns/campaign-grid";
import { Button } from "@/components/ui/button";
import { useIndexedCampaigns } from "@/hooks/use-indexed-campaigns";

const PAGE_SIZE = 9;

export default function CampaignsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState<"recent" | "funded" | "deadline">("recent");
  const { campaigns, totalPages, isLoading, error, index } =
    useIndexedCampaigns({
      page,
      pageSize: PAGE_SIZE,
      search,
      status: filter,
      sort,
    });
  return (
    <div className="mx-auto min-h-[75vh] max-w-7xl px-4 py-14 sm:px-6">
      <div className="max-w-3xl">
        <p className="text-sm font-semibold text-lime-300">DISCOVER</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
          Back work that should exist.
        </h1>
        <p className="mt-4 text-slate-400">
          Searchable results come from finalized indexed events. Open a campaign
          to verify current financial state directly against the contract.
        </p>
      </div>
      <div className="my-9 grid gap-3 rounded-3xl border border-white/10 bg-white/3 p-3 md:grid-cols-[1fr_auto_auto]">
        <label className="relative">
          <span className="sr-only">Search campaigns</span>
          <Search
            className="absolute top-3.5 left-4 text-slate-500"
            size={18}
          />
          <input
            className="field pl-11"
            placeholder="Search title or description"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <select
          className="field md:w-44"
          aria-label="Filter by status"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="successful">Successful</option>
          <option value="failed">Failed</option>
          <option value="completed">Completed</option>
        </select>
        <select
          className="field md:w-44"
          aria-label="Sort campaigns"
          value={sort}
          onChange={(event) =>
            setSort(event.target.value as "recent" | "funded" | "deadline")
          }
        >
          <option value="recent">Recently created</option>
          <option value="funded">Most funded</option>
          <option value="deadline">Deadline soon</option>
        </select>
      </div>
      {index && (!index.complete || index.stale) && (
        <p
          role="status"
          className="mb-5 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm text-amber-100"
        >
          Indexed data is {index.stale ? "stale" : "still synchronizing"} at
          block {index.indexed_through_block ?? "unknown"}. Verify current state
          on the campaign page.
        </p>
      )}
      <CampaignGrid campaigns={campaigns} isLoading={isLoading} error={error} />
      {totalPages > 1 && (
        <div className="mt-9 flex items-center justify-center gap-3">
          <Button
            variant="secondary"
            disabled={page === 1}
            onClick={() => setPage((value) => value - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-slate-400">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={page === totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
