import { clsx, type ClassValue } from "clsx";
import { formatUnits } from "viem";
import { twMerge } from "tailwind-merge";
import { CampaignStatus, type Campaign } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function shortAddress(value: string, size = 4) {
  return `${value.slice(0, size + 2)}…${value.slice(-size)}`;
}

export function formatToken(
  value: bigint,
  decimals: number,
  maximumFractionDigits = 2,
) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits }).format(
    Number(formatUnits(value, decimals)),
  );
}

export function fundingPercent(pledged: bigint, goal: bigint) {
  if (goal === 0n) return 0;
  return Math.min(Number((pledged * 10_000n) / goal) / 100, 999);
}

export function statusLabel(status: CampaignStatus, fundsClaimed = false) {
  if (status === CampaignStatus.Active) return "Active";
  if (status === CampaignStatus.Successful)
    return fundsClaimed ? "Funded · claimed" : "Successful";
  return "Failed";
}

export function deadlineLabel(deadline: bigint, now = Date.now()) {
  const delta = Number(deadline) * 1000 - now;
  if (delta <= 0) return "Campaign ended";
  const days = Math.ceil(delta / 86_400_000);
  return `${days} day${days === 1 ? "" : "s"} left`;
}

export function canClaimFunds(
  campaign: Campaign,
  account?: string,
  now = Date.now(),
) {
  return Boolean(
    account &&
      campaign.creator.toLowerCase() === account.toLowerCase() &&
      campaign.status === CampaignStatus.Successful &&
      !campaign.fundsClaimed &&
      Number(campaign.deadline) * 1000 <= now,
  );
}

export function canClaimRefund(
  campaign: Campaign,
  pledgedByUser: bigint,
  now = Date.now(),
) {
  return (
    campaign.status === CampaignStatus.Failed &&
    pledgedByUser > 0n &&
    Number(campaign.deadline) * 1000 <= now
  );
}

export function needsTokenApproval(allowance: bigint, amount: bigint) {
  return amount > 0n && allowance < amount;
}

export function friendlyError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message
      : "The request could not be completed.";
  if (/rejected|denied/i.test(message))
    return "The wallet request was rejected.";
  if (/insufficient funds/i.test(message))
    return "The wallet does not have enough native currency for gas.";
  if (/network|chain/i.test(message))
    return "Your wallet is connected to the wrong network.";
  return message.split("\n")[0] ?? "The transaction failed.";
}
