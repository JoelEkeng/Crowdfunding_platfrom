# Testing strategy and results

## Layers

- Foundry unit and fuzz tests validate campaign parameters, token behavior, lifecycle boundaries, rollback, and raw units.
- Foundry stateful invariants validate aggregate liabilities, single settlement, authorization, and mutually exclusive outcomes.
- Frontend tests validate form rules, network/wallet states, approval eligibility, transaction presentation, data states, and indexed API conversion.
- Backend tests validate API contracts, event decoding, idempotency, restart, rollback, outages, confirmations, reorganizations, staleness, health, and rate limiting.
- Anvil integration deploys the actual contracts and indexes a real event.
- The full local E2E test creates successful and failed campaigns, performs multiple real approvals/pledges, advances Anvil time beyond the actual deadlines, tests permitted and forbidden settlement transitions, indexes every event, and verifies API search results.

## Commands

```sh
cd packages/contracts
forge fmt --check
forge build
forge test

cd ../../apps/web
pnpm exec prettier --check "app/**/*.{ts,tsx,css}" "components/**/*.{ts,tsx}" "hooks/**/*.{ts,tsx}" "lib/**/*.{ts,tsx}" "test/**/*.ts"
pnpm lint
pnpm typecheck
pnpm test
pnpm build

cd ../api
uv run ruff format --check .
uv run ruff check .
uv run mypy src
uv run pytest -q
RUN_ANVIL_TESTS=1 uv run pytest -q tests/integration/test_anvil_indexer.py
RUN_E2E_TESTS=1 uv run pytest -q tests/e2e/test_local_lifecycles.py
```

Database migration validation:

```sh
uv run alembic upgrade head
```

## Verified results (2026-10-16)

- `forge fmt --check`, `forge build`, and `forge test` passed: 26 Solidity tests, including 2 fuzz tests and 2 invariant suites.
- `pnpm lint`, `pnpm typecheck`, and `pnpm test` passed: 19 frontend tests across 6 files.
- `pnpm build` passed using webpack (the project build script explicitly selects webpack). The build reports non-fatal optional peer-dependency resolution warnings from the MetaMask and WalletConnect dependency trees.
- `uv run ruff format --check .`, `uv run ruff check .`, `uv run mypy src`, and `uv run pytest -q` passed: 14 tests passed and 2 integration tests were skipped until explicitly enabled.
- `RUN_ANVIL_TESTS=1 uv run pytest -q tests/integration/test_anvil_indexer.py` passed.
- `RUN_E2E_TESTS=1 uv run pytest -q tests/e2e/test_local_lifecycles.py` passed.
- Alembic's migration graph was validated with `uv run alembic history --verbose`. A live PostgreSQL migration could not be run in this environment: Docker is not installed and only the PostgreSQL client tools are available (the server binary is absent). Run `uv run alembic upgrade head` against the documented PostgreSQL service before a release.

## Scenario coverage

Successful lifecycle: multiple supporters exceed the goal, post-deadline pledge rejection, creator-only single claim, and successful-campaign refund rejection.

Failed lifecycle: below-goal pledges, creator claim rejection, full supporter refunds, and duplicate refund rejection.

Error/security coverage includes wrong network, disconnected wallet, rejected signature messaging, insufficient allowance, token transfer failure, post-deadline and unauthorized actions, RPC outage, stale/backend error states, duplicate event delivery, malformed form input, missing configuration, indexer restart, and reorganization recovery.

## Interpretation

A passing suite demonstrates the tested behavior for these versions and environments. It is not formal verification, a professional audit, load testing, browser-matrix certification, or proof of production readiness. Public testnet behavior remains unverified until a deployment is independently confirmed.
