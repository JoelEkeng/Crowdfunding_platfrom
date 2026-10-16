# Project guidance

- The Foundry package is in `packages/contracts`.
- Run `forge fmt --check`, `forge build`, and `forge test` from `packages/contracts`.
- Shared Solidity dependencies are Git submodules in the repository-root `lib` directory and are resolved by `packages/contracts/foundry.toml`.
- The Next.js frontend is in `apps/web` and uses pnpm. Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build` from that directory.
- Frontend chain state is configured only through `apps/web/.env.local`; never use an Anvil address as a public-network fallback.
- The FastAPI service is in `apps/api` and uses uv. Run `uv run ruff format --check .`, `uv run ruff check .`, `uv run mypy src`, and `uv run pytest -q` there.
- Run the API and blockchain indexer as separate processes; indexed financial data is never authoritative for contract actions.
