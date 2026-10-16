import type { Address, Hash } from "viem";

export enum CampaignStatus {
  Active,
  Successful,
  Failed,
}

export type Campaign = {
  id: bigint;
  creator: Address;
  token: Address;
  goal: bigint;
  deadline: bigint;
  pledged: bigint;
  refunded: bigint;
  fundsClaimed: boolean;
  title: string;
  description: string;
  imageURI: string;
  status: CampaignStatus;
};

export type RewardTier = { minimumContribution: bigint; perk: string };
export type TxPhase =
  | "idle"
  | "awaiting-signature"
  | "pending"
  | "confirmed"
  | "reverted"
  | "uncertain";
export type TxState = { phase: TxPhase; hash?: Hash; message?: string };
