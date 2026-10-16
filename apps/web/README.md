# FundChain web

Next.js 16 App Router frontend for the current FundChain contracts. Campaigns and activity are read directly from the configured chain; there is no backend or mock-success adapter.

## Setup

From `apps/web`:

```sh
cp .env.example .env.local
pnpm install
pnpm dev
```

Set every public variable deliberately. `NEXT_PUBLIC_CROWDFUNDING_ADDRESS` must be a deployment on `NEXT_PUBLIC_CHAIN_ID`; `NEXT_PUBLIC_DEPLOYMENT_BLOCK` bounds event scans. `NEXT_PUBLIC_TOKEN_*` must describe the token trusted by that deployment. No Anvil address is used as a fallback. Public RPC URLs and WalletConnect project IDs are visible in browser bundles by design; never put a private key or secret API credential in a `NEXT_PUBLIC_` variable.

## Data interface

Until a backend/indexer exists, the development adapter is the chain itself:

- Contract reads and multicalls load campaign state.
- `CampaignCreated` and `Pledged` logs populate wallet dashboards.
- `Pledged`, `FundsClaimed`, and `Refunded` logs populate public activity.
- The deployment block prevents scanning chain history before FundChain existed.

Large deployments should replace this log adapter with a separately specified indexer API. Contract reads remain authoritative for transaction eligibility.

## Verification

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Transaction state is not optimistic: awaiting signature, submitted/pending, confirmed, reverted, and confirmation-uncertain are represented separately. Reads refetch only after a successful receipt.
