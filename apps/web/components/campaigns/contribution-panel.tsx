"use client";

import { useState } from "react";
import { maxUint256, parseUnits } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { crowdfundingAbi, erc20Abi } from "@/lib/abi/crowdfunding";
import { appConfig } from "@/lib/config";
import type { Campaign, RewardTier } from "@/lib/types";
import { friendlyError, formatToken, needsTokenApproval } from "@/lib/utils";
import { useContractAction } from "@/hooks/use-contract-action";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TransactionStatus } from "@/components/web3/transaction-status";

export function ContributionPanel({
  campaign,
  tiers,
  onConfirmed,
}: {
  campaign: Campaign;
  tiers: readonly RewardTier[];
  onConfirmed: () => unknown | Promise<unknown>;
}) {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState("");
  const [tierId, setTierId] = useState(0);
  const [error, setError] = useState("");
  let parsedAmount = 0n;
  try {
    parsedAmount = parseUnits(amount || "0", appConfig.supportedToken.decimals);
  } catch {
    parsedAmount = 0n;
  }
  const allowance = useReadContract({
    address: campaign.token,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address ?? appConfig.contractAddress, appConfig.contractAddress],
    chainId: appConfig.chainId,
    query: { enabled: Boolean(address) },
  });
  const approve = useContractAction(() => allowance.refetch());
  const pledge = useContractAction(onConfirmed);
  const needsApproval = needsTokenApproval(allowance.data ?? 0n, parsedAmount);
  const selectedMinimum = tierId
    ? (tiers[tierId - 1]?.minimumContribution ?? 0n)
    : 0n;
  async function contribute() {
    setError("");
    if (parsedAmount <= 0n) {
      setError("Enter a positive contribution amount.");
      return;
    }
    if (parsedAmount < selectedMinimum) {
      setError(
        `This tier requires at least ${formatToken(selectedMinimum, appConfig.supportedToken.decimals)} ${appConfig.supportedToken.symbol}.`,
      );
      return;
    }
    if (needsApproval) {
      await approve.execute({
        address: campaign.token,
        abi: erc20Abi,
        functionName: "approve",
        args: [appConfig.contractAddress, maxUint256],
      });
      return;
    }
    if (
      !window.confirm(
        `Pledge ${amount} ${appConfig.supportedToken.symbol} to ${campaign.title}?`,
      )
    )
      return;
    try {
      await pledge.execute({
        address: appConfig.contractAddress,
        abi: crowdfundingAbi,
        functionName: "pledge",
        args: [campaign.id, parsedAmount, BigInt(tierId)],
      });
    } catch (cause) {
      setError(friendlyError(cause));
    }
  }
  return (
    <Card className="p-6">
      <p className="text-xs font-semibold text-lime-300">SUPPORT THIS WORK</p>
      <div className="mt-5">
        <label className="label" htmlFor="contribution">
          Contribution ({appConfig.supportedToken.symbol})
        </label>
        <input
          id="contribution"
          className="field"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
      </div>
      {tiers.length > 0 && (
        <fieldset className="mt-5">
          <legend className="label">Reward tier</legend>
          <div className="space-y-2">
            <label className="flex cursor-pointer gap-3 rounded-2xl border border-white/10 p-3">
              <input
                type="radio"
                name="tier"
                checked={tierId === 0}
                onChange={() => setTierId(0)}
              />
              <span>
                <strong className="text-sm">No reward</strong>
                <span className="block text-xs text-slate-500">
                  Support without selecting a perk
                </span>
              </span>
            </label>
            {tiers.map((tier, index) => (
              <label
                key={index}
                className="flex cursor-pointer gap-3 rounded-2xl border border-white/10 p-3"
              >
                <input
                  type="radio"
                  name="tier"
                  checked={tierId === index + 1}
                  onChange={() => {
                    setTierId(index + 1);
                    setAmount(
                      formatToken(
                        tier.minimumContribution,
                        appConfig.supportedToken.decimals,
                        appConfig.supportedToken.decimals,
                      ),
                    );
                  }}
                />
                <span>
                  <strong className="text-sm">
                    {formatToken(
                      tier.minimumContribution,
                      appConfig.supportedToken.decimals,
                    )}{" "}
                    {appConfig.supportedToken.symbol}
                  </strong>
                  <span className="block text-xs text-slate-500">
                    {tier.perk}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <Button
        className="mt-6 w-full"
        disabled={
          !isConnected ||
          pledge.state.phase === "pending" ||
          approve.state.phase === "pending"
        }
        onClick={contribute}
      >
        {!isConnected
          ? "Connect wallet to contribute"
          : needsApproval
            ? `Approve ${appConfig.supportedToken.symbol}`
            : "Review pledge"}
      </Button>
      {error && (
        <p role="alert" className="mt-3 text-sm text-rose-300">
          {error}
        </p>
      )}
      <TransactionStatus state={needsApproval ? approve.state : pledge.state} />
    </Card>
  );
}
