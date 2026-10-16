import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-white/10 bg-slate-900/70 shadow-2xl shadow-black/10 backdrop-blur",
        className,
      )}
      {...props}
    />
  );
}
