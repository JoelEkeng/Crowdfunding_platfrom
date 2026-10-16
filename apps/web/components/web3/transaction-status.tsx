import { CheckCircle2, CircleAlert, LoaderCircle, Radio } from "lucide-react";
import { explorerTxUrl } from "@/lib/config";
import type { TxState } from "@/lib/types";

export function TransactionStatus({ state }: { state: TxState }) {
  if (state.phase === "idle") return null;
  const pending =
    state.phase === "awaiting-signature" || state.phase === "pending";
  const Icon = pending
    ? LoaderCircle
    : state.phase === "confirmed"
      ? CheckCircle2
      : state.phase === "uncertain"
        ? Radio
        : CircleAlert;
  const url = state.hash ? explorerTxUrl(state.hash) : undefined;
  return (
    <div
      role="status"
      className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-black/20 p-4"
    >
      <Icon
        className={
          pending
            ? "animate-spin text-lime-300"
            : state.phase === "confirmed"
              ? "text-emerald-300"
              : "text-amber-300"
        }
      />
      <div>
        <p className="text-sm font-semibold capitalize">
          {state.phase.replace("-", " ")}
        </p>
        <p className="mt-1 text-sm text-slate-400">{state.message}</p>
        {url && (
          <a
            className="mt-2 inline-block text-sm text-lime-300 hover:underline"
            href={url}
            target="_blank"
            rel="noreferrer"
          >
            View transaction
          </a>
        )}
      </div>
    </div>
  );
}
