"use client";

import { useAccount } from "wagmi";
import { crowdfundingAbi } from "@/lib/abi/crowdfunding";
import { appConfig } from "@/lib/config";
import type { Campaign } from "@/lib/types";
import { canClaimFunds, canClaimRefund, formatToken } from "@/lib/utils";
import { useContractAction } from "@/hooks/use-contract-action";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { TransactionStatus } from "@/components/web3/transaction-status";

export function SettlementPanel({
  campaign,
  pledgedByUser,
  onConfirmed,
}: {
  campaign: Campaign;
  pledgedByUser: bigint;
  onConfirmed: () => unknown | Promise<unknown>;
}) {
  const { address } = useAccount();
  const claim = useContractAction(onConfirmed);
  const refund = useContractAction(onConfirmed);
  const creatorEligible = canClaimFunds(campaign, address);
  const refundEligible = canClaimRefund(campaign, pledgedByUser);
  if (!creatorEligible && !refundEligible) return null;
  return (
    <Card className="border-lime-300/20 p-6">
      <p className="text-xs font-semibold text-lime-300">
        SETTLEMENT AVAILABLE
      </p>
      {creatorEligible && (
        <>
          <h2 className="mt-3 text-xl font-semibold">
            Claim successful funding
          </h2>
          <p className="mt-2 text-sm text-slate-400">
            Only the campaign creator can withdraw the confirmed gross pledged
            amount.
          </p>
          <Button
            className="mt-5 w-full"
            onClick={() =>
              window.confirm(
                "Claim all campaign funds? This action cannot be repeated.",
              ) &&
              claim.execute({
                address: appConfig.contractAddress,
                abi: crowdfundingAbi,
                functionName: "claimFunds",
                args: [campaign.id],
              })
            }
          >
            Claim funds
          </Button>
          <TransactionStatus state={claim.state} />
        </>
      )}
      {refundEligible && (
        <>
          <h2 className="mt-3 text-xl font-semibold">Refund available</h2>
          <p className="mt-2 text-sm text-slate-400">
            Your refundable pledge is{" "}
            {formatToken(pledgedByUser, appConfig.supportedToken.decimals)}{" "}
            {appConfig.supportedToken.symbol}.
          </p>
          <Button
            className="mt-5 w-full"
            variant="secondary"
            onClick={() =>
              window.confirm("Claim your full refundable pledge?") &&
              refund.execute({
                address: appConfig.contractAddress,
                abi: crowdfundingAbi,
                functionName: "claimRefund",
                args: [campaign.id],
              })
            }
          >
            Claim refund
          </Button>
          <TransactionStatus state={refund.state} />
        </>
      )}
    </Card>
  );
}
