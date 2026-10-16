import { cn } from "@/lib/utils";

export function Progress({
  value,
  className,
}: {
  value: number;
  className?: string;
}) {
  const bounded = Math.min(Math.max(value, 0), 100);
  return (
    <div
      role="progressbar"
      aria-valuenow={bounded}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2 overflow-hidden rounded-full bg-white/10", className)}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-lime-300 to-emerald-400 transition-all"
        style={{ width: `${bounded}%` }}
      />
    </div>
  );
}
