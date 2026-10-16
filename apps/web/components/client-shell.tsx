"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

const Providers = dynamic(
  () => import("./providers").then((module) => module.Providers),
  {
    ssr: false,
    loading: () => (
      <div className="grid min-h-screen place-items-center bg-slate-950 text-sm text-slate-400">
        Preparing secure wallet connection…
      </div>
    ),
  },
);

export function ClientShell({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}
