import { render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { CampaignStatus, type Campaign } from "@/lib/types";
import { CampaignCard } from "./campaign-card";

vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

it("handles missing campaign metadata without inventing content", () => {
  const campaign: Campaign = {
    id: 1n,
    creator: "0x1111111111111111111111111111111111111111",
    token: "0x2222222222222222222222222222222222222222",
    goal: 100n,
    pledged: 0n,
    refunded: 0n,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
    fundsClaimed: false,
    title: "Minimal campaign",
    description: "",
    imageURI: "",
    status: CampaignStatus.Active,
  };
  render(<CampaignCard campaign={campaign} />);
  expect(screen.getByText("No description provided.")).toBeInTheDocument();
  expect(screen.queryByRole("img")).not.toBeInTheDocument();
});
