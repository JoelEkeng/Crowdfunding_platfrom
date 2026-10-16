import { appConfig } from "@/lib/config";

export function ConfigNotice() {
  if (appConfig.isConfigured && appConfig.isApiConfigured) return null;
  return (
    <div
      role="alert"
      className="border-b border-amber-300/20 bg-amber-300/10 px-4 py-3 text-center text-sm text-amber-100"
    >
      FundChain is not fully configured. Set the API URL, RPC URL, token, and
      deployed contract address in <code>.env.local</code>.
    </div>
  );
}
