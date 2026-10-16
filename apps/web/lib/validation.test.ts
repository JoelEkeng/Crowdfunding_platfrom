import { describe, expect, it } from "vitest";
import { campaignSchema } from "./validation";

const valid = () => ({
  title: "Open wallet",
  description: "A transparent wallet",
  imageURI: "",
  goal: "1000",
  deadline: new Date(Date.now() + 7 * 86_400_000).toISOString(),
  tiers: [],
});

describe("campaignSchema", () => {
  it("accepts valid campaign terms", () => {
    expect(campaignSchema.safeParse(valid()).success).toBe(true);
  });
  it("rejects an empty title and invalid goal", () => {
    const result = campaignSchema.safeParse({
      ...valid(),
      title: "",
      goal: "0",
    });
    expect(result.success).toBe(false);
  });
  it("rejects deadlines outside contract limits", () => {
    const result = campaignSchema.safeParse({
      ...valid(),
      deadline: new Date(Date.now() + 30_000).toISOString(),
    });
    expect(result.success).toBe(false);
  });
  it("rejects unordered reward tiers", () => {
    const result = campaignSchema.safeParse({
      ...valid(),
      tiers: [
        { minimum: "10", perk: "First" },
        { minimum: "5", perk: "Second" },
      ],
    });
    expect(result.success).toBe(false);
  });
  it("counts UTF-8 bytes like the contract", () => {
    const result = campaignSchema.safeParse({
      ...valid(),
      title: "é".repeat(60),
    });
    expect(result.success).toBe(false);
  });
});
