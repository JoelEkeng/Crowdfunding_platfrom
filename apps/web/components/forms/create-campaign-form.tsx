"use client";

import { Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseUnits } from "viem";
import { useAccount } from "wagmi";
import { crowdfundingAbi } from "@/lib/abi/crowdfunding";
import { appChain, appConfig } from "@/lib/config";
import { campaignSchema, type CampaignFormValues } from "@/lib/validation";
import { useContractAction } from "@/hooks/use-contract-action";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TransactionStatus } from "@/components/web3/transaction-status";

const initial: CampaignFormValues = {
  title: "",
  description: "",
  imageURI: "",
  goal: "",
  deadline: "",
  tiers: [],
};

export function CreateCampaignForm() {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const { isConnected } = useAccount();
  const router = useRouter();
  const action = useContractAction(() => router.push("/dashboard"));
  function update<K extends keyof CampaignFormValues>(
    key: K,
    value: CampaignFormValues[K],
  ) {
    setValues((current) => ({ ...current, [key]: value }));
  }
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = campaignSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(
        Object.fromEntries(
          parsed.error.issues.map((issue) => [
            issue.path.join("."),
            issue.message,
          ]),
        ),
      );
      return;
    }
    setErrors({});
    const data = parsed.data;
    await action.execute({
      address: appConfig.contractAddress,
      abi: crowdfundingAbi,
      functionName: "createCampaign",
      args: [
        data.title,
        data.description,
        data.imageURI,
        parseUnits(data.goal, appConfig.supportedToken.decimals),
        appConfig.supportedToken.address,
        BigInt(Math.floor(new Date(data.deadline).getTime() / 1000)),
        data.tiers.map((tier) => ({
          minimumContribution: parseUnits(
            tier.minimum,
            appConfig.supportedToken.decimals,
          ),
          perk: tier.perk,
        })),
      ],
    });
  }
  return (
    <form
      onSubmit={submit}
      noValidate
      className="grid gap-6 lg:grid-cols-[1fr_22rem]"
    >
      <Card className="space-y-6 p-6 sm:p-8">
        <div>
          <label className="label" htmlFor="title">
            Campaign title
          </label>
          <input
            id="title"
            className="field"
            value={values.title}
            onChange={(e) => update("title", e.target.value)}
            aria-describedby="title-error"
          />
          {errors.title && (
            <p id="title-error" className="mt-2 text-sm text-rose-300">
              {errors.title}
            </p>
          )}
        </div>
        <div>
          <label className="label" htmlFor="description">
            Description
          </label>
          <textarea
            id="description"
            className="field min-h-40 resize-y"
            value={values.description}
            onChange={(e) => update("description", e.target.value)}
          />
          {errors.description && (
            <p className="mt-2 text-sm text-rose-300">{errors.description}</p>
          )}
        </div>
        <div>
          <label className="label" htmlFor="image">
            Image URI{" "}
            <span className="font-normal text-slate-500">optional</span>
          </label>
          <input
            id="image"
            className="field"
            placeholder="ipfs://… or https://…"
            value={values.imageURI}
            onChange={(e) => update("imageURI", e.target.value)}
          />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="goal">
              Goal ({appConfig.supportedToken.symbol})
            </label>
            <input
              id="goal"
              inputMode="decimal"
              className="field"
              value={values.goal}
              onChange={(e) => update("goal", e.target.value)}
            />
            {errors.goal && (
              <p className="mt-2 text-sm text-rose-300">{errors.goal}</p>
            )}
          </div>
          <div>
            <label className="label" htmlFor="deadline">
              Deadline
            </label>
            <input
              id="deadline"
              type="datetime-local"
              className="field"
              value={values.deadline}
              onChange={(e) => update("deadline", e.target.value)}
            />
            {errors.deadline && (
              <p className="mt-2 text-sm text-rose-300">{errors.deadline}</p>
            )}
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Reward tiers</h2>
              <p className="text-sm text-slate-500">
                Optional, informational perks. Minimums must increase.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={values.tiers.length >= 20}
              onClick={() =>
                update("tiers", [...values.tiers, { minimum: "", perk: "" }])
              }
            >
              <Plus size={16} /> Add tier
            </Button>
          </div>
          <div className="mt-4 space-y-3">
            {values.tiers.map((tier, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-2xl border border-white/8 bg-white/3 p-4 sm:grid-cols-[10rem_1fr_auto]"
              >
                <div>
                  <label className="label" htmlFor={`tier-min-${index}`}>
                    Minimum
                  </label>
                  <input
                    id={`tier-min-${index}`}
                    className="field"
                    value={tier.minimum}
                    onChange={(e) => {
                      const tiers = [...values.tiers];
                      tiers[index] = { ...tier, minimum: e.target.value };
                      update("tiers", tiers);
                    }}
                  />
                </div>
                <div>
                  <label className="label" htmlFor={`tier-perk-${index}`}>
                    Perk
                  </label>
                  <input
                    id={`tier-perk-${index}`}
                    className="field"
                    value={tier.perk}
                    onChange={(e) => {
                      const tiers = [...values.tiers];
                      tiers[index] = { ...tier, perk: e.target.value };
                      update("tiers", tiers);
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  className="self-end"
                  aria-label={`Remove tier ${index + 1}`}
                  onClick={() =>
                    update(
                      "tiers",
                      values.tiers.filter((_, i) => i !== index),
                    )
                  }
                >
                  <Trash2 size={17} />
                </Button>
                {errors[`tiers.${index}.minimum`] && (
                  <p className="text-sm text-rose-300 sm:col-span-3">
                    {errors[`tiers.${index}.minimum`]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>
      <aside>
        <Card className="sticky top-24 p-6">
          <p className="text-xs font-semibold text-lime-300">
            TRANSACTION REVIEW
          </p>
          <dl className="mt-5 space-y-4 text-sm">
            <div>
              <dt className="text-slate-500">Network</dt>
              <dd className="mt-1 font-semibold">
                {appChain.name} · {appConfig.chainId}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Token</dt>
              <dd className="mt-1 font-semibold">
                {appConfig.supportedToken.symbol}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Estimated cost</dt>
              <dd className="mt-1 text-slate-300">
                Your wallet will simulate and show the final gas estimate before
                signature.
              </dd>
            </div>
          </dl>
          <Button
            type="submit"
            className="mt-6 w-full"
            disabled={
              !isConnected ||
              action.state.phase === "pending" ||
              action.state.phase === "awaiting-signature"
            }
          >
            {isConnected ? "Review & launch" : "Connect wallet to launch"}
          </Button>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            Contract validation is authoritative. Campaign terms cannot be
            edited after confirmation.
          </p>
          <TransactionStatus state={action.state} />
        </Card>
      </aside>
    </form>
  );
}
