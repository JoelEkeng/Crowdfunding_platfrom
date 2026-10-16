"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { appChain, appConfig } from "@/lib/config";
import { Button } from "@/components/ui/button";

export function NetworkGuard() {
  const { isConnected, chainId } = useAccount();
  const { switchChain } = useSwitchChain();
  if (!isConnected || chainId === appConfig.chainId) return null;
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-center gap-3 bg-amber-300 px-4 py-2 text-sm font-medium text-slate-950"
    >
      <span>Wrong network. FundChain is configured for {appChain.name}.</span>
      <Button
        size="sm"
        className="bg-slate-950 text-white"
        onClick={() => switchChain({ chainId: appConfig.chainId })}
      >
        Switch network
      </Button>
    </div>
  );
}
