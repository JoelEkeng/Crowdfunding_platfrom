import { AlertTriangle, Inbox } from "lucide-react";
import { Card } from "./card";

export function EmptyState({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <Card className="grid min-h-64 place-items-center p-8 text-center">
      <div>
        <Inbox className="mx-auto mb-4 text-slate-500" />
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="mt-2 max-w-md text-sm text-slate-400">{message}</p>
      </div>
    </Card>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <Card
      role="alert"
      className="flex items-start gap-3 border-rose-400/20 p-5 text-rose-100"
    >
      <AlertTriangle className="mt-0.5 shrink-0" />
      <div>
        <p className="font-semibold">Unable to load on-chain data</p>
        <p className="mt-1 text-sm text-rose-200/70">{message}</p>
      </div>
    </Card>
  );
}
