import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NetworkGuard } from "./network-guard";

const mocks = vi.hoisted(() => ({ useAccount: vi.fn(), switchChain: vi.fn() }));
vi.mock("wagmi", () => ({
  useAccount: mocks.useAccount,
  useSwitchChain: () => ({ switchChain: mocks.switchChain }),
}));

describe("NetworkGuard", () => {
  beforeEach(() => vi.clearAllMocks());
  it("renders nothing while disconnected", () => {
    mocks.useAccount.mockReturnValue({ isConnected: false });
    const { container } = render(<NetworkGuard />);
    expect(container).toBeEmptyDOMElement();
  });
  it("renders nothing on the configured chain", () => {
    mocks.useAccount.mockReturnValue({ isConnected: true, chainId: 11155111 });
    const { container } = render(<NetworkGuard />);
    expect(container).toBeEmptyDOMElement();
  });
  it("warns and requests a network switch", async () => {
    mocks.useAccount.mockReturnValue({ isConnected: true, chainId: 1 });
    render(<NetworkGuard />);
    expect(screen.getByRole("alert")).toHaveTextContent("Wrong network");
    await userEvent.click(
      screen.getByRole("button", { name: /switch network/i }),
    );
    expect(mocks.switchChain).toHaveBeenCalledWith({ chainId: 11155111 });
  });
});
