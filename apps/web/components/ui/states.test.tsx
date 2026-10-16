import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CampaignGrid } from "@/components/campaigns/campaign-grid";
import { TransactionStatus } from "@/components/web3/transaction-status";

vi.mock("next/link", () => ({
  default: ({ children }: { children: React.ReactNode }) => children,
}));

describe("data and transaction states", () => {
  it("renders campaign loading skeletons", () => {
    render(<CampaignGrid campaigns={[]} isLoading />);
    expect(screen.getByLabelText("Loading campaigns")).toBeInTheDocument();
  });
  it("renders an empty state", () => {
    render(<CampaignGrid campaigns={[]} />);
    expect(screen.getByText("No campaigns found")).toBeInTheDocument();
  });
  it("renders RPC errors", () => {
    render(
      <CampaignGrid campaigns={[]} error={new Error("RPC unavailable")} />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("RPC unavailable");
  });
  it("does not call a pending transaction confirmed", () => {
    render(
      <TransactionStatus
        state={{ phase: "pending", hash: "0x123", message: "Waiting" }}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("pending");
    expect(screen.queryByText(/confirmed on-chain/i)).not.toBeInTheDocument();
  });
  it("shows reverted and uncertain confirmation states", () => {
    const { rerender } = render(
      <TransactionStatus state={{ phase: "reverted", message: "Reverted" }} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("reverted");
    rerender(
      <TransactionStatus state={{ phase: "uncertain", message: "RPC lost" }} />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("uncertain");
  });
});
