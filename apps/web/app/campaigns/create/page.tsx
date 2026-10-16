import { CreateCampaignForm } from "@/components/forms/create-campaign-form";

export default function CreateCampaignPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <div className="mb-9 max-w-3xl">
        <p className="text-sm font-semibold text-lime-300">CREATE ON-CHAIN</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">
          Launch with terms that stay put.
        </h1>
        <p className="mt-4 text-slate-400">
          Review every field carefully. Goal, token, deadline, and reward tiers
          become immutable once the transaction confirms.
        </p>
      </div>
      <CreateCampaignForm />
    </div>
  );
}
