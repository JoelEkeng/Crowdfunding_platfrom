import { describe, expect, it } from "vitest";
import { CampaignStatus } from "@/lib/types";
import { mapIndexedCampaign } from "./use-indexed-campaigns";

describe("indexed campaign adapter", () => {
  it("preserves base-unit integer strings and API status", () => {
    const campaign = mapIndexedCampaign({
      campaign_id: "900719925474099300000",
      creator: "0x1111111111111111111111111111111111111111",
      token: "0x2222222222222222222222222222222222222222",
      goal: "1000000000000000000000",
      deadline: "2026-01-01T00:00:00Z",
      total_pledged: "1100000000000000000000",
      total_refunded: "0",
      funds_claimed: false,
      title: "Indexed campaign",
      description: "Finalized event projection",
      image_uri: "",
      status: "successful",
    });
    expect(campaign.id).toBe(900719925474099300000n);
    expect(campaign.pledged).toBe(1100000000000000000000n);
    expect(campaign.status).toBe(CampaignStatus.Successful);
  });
});
