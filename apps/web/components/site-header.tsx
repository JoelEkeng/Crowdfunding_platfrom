"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Menu, Sprout } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "./ui/button";

const links = [
  { href: "/campaigns", label: "Discover" },
  { href: "/campaigns/create", label: "Launch" },
  { href: "/dashboard", label: "Dashboard" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-slate-950/80 backdrop-blur-xl">
      <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold tracking-tight"
        >
          <span className="grid size-9 place-items-center rounded-xl bg-lime-300 text-slate-950">
            <Sprout size={20} />
          </span>
          FundChain
        </Link>
        <nav
          className="hidden items-center gap-1 md:flex"
          aria-label="Primary navigation"
        >
          {links.map((link) => (
            <Button key={link.href} asChild variant="ghost">
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </nav>
        <div className="hidden md:block">
          <ConnectButton
            accountStatus="address"
            showBalance={false}
            chainStatus="icon"
          />
        </div>
        <button
          className="rounded-xl p-2 md:hidden"
          aria-label="Toggle navigation"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Menu />
        </button>
      </div>
      {open && (
        <div className="border-t border-white/8 p-4 md:hidden">
          <nav className="grid gap-2">
            {links.map((link) => (
              <Link
                key={link.href}
                className="rounded-xl px-3 py-2 hover:bg-white/5"
                href={link.href}
                onClick={() => setOpen(false)}
              >
                {link.label}
              </Link>
            ))}
            <div className="mt-2">
              <ConnectButton />
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
