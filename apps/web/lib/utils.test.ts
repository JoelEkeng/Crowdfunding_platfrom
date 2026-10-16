import { describe, expect, it } from "vitest";
import { CampaignStatus, type Campaign } from "./types";
import {
  canClaimFunds,
  canClaimRefund,
  friendlyError,
  needsTokenApproval,
} from "./utils";

const account = "0x1111111111111111111111111111111111111111" as const;
const campaign = (status: CampaignStatus): Campaign => ({
  id: 1n,
  creator: account,
  token: "0x2222222222222222222222222222222222222222",
  goal: 100n,
  pledged: 100n,
  refunded: 0n,
  deadline: 1n,
  fundsClaimed: false,
  title: "Test",
  description: "",
  imageURI: "",
  status,
});

describe("lifecycle eligibility", () => {
  it("restricts successful withdrawal to the creator", () => {
    expect(
      canClaimFunds(campaign(CampaignStatus.Successful), account, 2_000),
    ).toBe(true);
    expect(
      canClaimFunds(
        campaign(CampaignStatus.Successful),
        campaign(CampaignStatus.Successful).token,
        2_000,
      ),
    ).toBe(false);
  });
  it("only enables refunds for failed campaigns with a pledge", () => {
    expect(canClaimRefund(campaign(CampaignStatus.Failed), 10n, 2_000)).toBe(
      true,
    );
    expect(
      canClaimRefund(campaign(CampaignStatus.Successful), 10n, 2_000),
    ).toBe(false);
    expect(canClaimRefund(campaign(CampaignStatus.Failed), 0n, 2_000)).toBe(
      false,
    );
  });
  it("models allowance and approval states", () => {
    expect(needsTokenApproval(5n, 10n)).toBe(true);
    expect(needsTokenApproval(10n, 10n)).toBe(false);
    expect(needsTokenApproval(0n, 0n)).toBe(false);
  });
  it("turns wallet rejection into useful feedback", () => {
    expect(friendlyError(new Error("User rejected the request"))).toMatch(
      /rejected/i,
    );
  });
});
