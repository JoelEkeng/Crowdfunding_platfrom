import type { Metadata } from "next";
import "./globals.css";
import { ClientShell } from "@/components/client-shell";
import { SiteHeader } from "@/components/site-header";
import { ConfigNotice } from "@/components/web3/config-notice";
import { NetworkGuard } from "@/components/web3/network-guard";

export const metadata: Metadata = {
  title: { default: "FundChain", template: "%s · FundChain" },
  description: "Transparent ERC-20 crowdfunding, settled on-chain.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ClientShell>
          <NetworkGuard />
          <ConfigNotice />
          <SiteHeader />
          <main>{children}</main>
          <footer className="mx-auto max-w-7xl border-t border-white/8 px-4 py-10 text-sm text-slate-500 sm:px-6">
            <div className="flex flex-wrap justify-between gap-3">
              <p>FundChain · funding rules enforced on-chain.</p>
              <p>Verify every transaction in your wallet.</p>
            </div>
          </footer>
        </ClientShell>
      </body>
    </html>
  );
}
