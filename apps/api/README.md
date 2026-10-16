# FundChain API and indexer

FastAPI discovery service and finalized Ethereum event indexer. It never holds keys, submits transactions, or authorizes creator claims/refunds. The FundChain contract remains the financial authority.

## Architecture

The indexer reads the exact `CampaignCreated`, `RewardTierCreated`, `Pledged`, `FundsClaimed`, and `Refunded` events emitted by `Crowdfunding.sol`. It writes:

- canonical processed block hashes and parent hashes;
- immutable event records unique by chain, contract, transaction hash, and log index;
- campaign, reward-tier, and supporter projections rebuilt from those records;
- a singleton synchronization checkpoint and operator-visible status.

Only blocks at or below `observed_head - CONFIRMATION_DEPTH` are indexed. Before advancing, the worker verifies its finalized checkpoint hash. A mismatch triggers a backward search for a common ancestor, deletion of orphaned blocks/events, deterministic projection rebuilding, and replay of the replacement branch. If no ancestor exists within `MAX_REORG_DEPTH`, the worker stops that iteration as degraded instead of guessing.

A bounded range and its checkpoint commit in one database transaction. RPC failures or malformed event sequences roll back the range. Replaying logs is idempotent.

## Indexed data semantics

All monetary values are token base-unit integers stored as PostgreSQL `NUMERIC(78,0)` and returned as decimal strings. API totals are finalized event-derived projections, not authorization decisions. Every response includes index freshness metadata. Frontends must read the contract immediately before offering or submitting financial actions.

Status is derived from indexed gross pledged amount, goal, deadline, and current time. A stale/incomplete index is explicitly marked and must not be presented as current chain truth.

## Setup

Python 3.11+ and `uv` are required. PostgreSQL can be started with the included Compose file where Docker is available:

```sh
docker compose up -d postgres
cp .env.example .env
uv sync --dev
uv run alembic upgrade head
```

Run the API and indexer as separate processes so production deployments can scale and supervise them independently:

```sh
uv run uvicorn fundchain.main:app --host 127.0.0.1 --port 8000
uv run python -m fundchain.indexer.worker
```

Configuration validation occurs before startup. RPC and database credentials are server-only and must never use browser-prefixed environment variables.

## Recovery and resynchronization

Stop the indexer before manual recovery, then choose a known canonical block at or after `INDEXER_START_BLOCK`:

```sh
uv run python -m fundchain.indexer.worker --resync-from 1234567
```

This deletes blocks and events from that height, rebuilds projections from retained canonical events, and resumes normal replay. Database backups remain required. Set confirmation depth according to the target chain's reorganization profile; 12 is an example, not a universal finality guarantee.

## Public API

Interactive OpenAPI documentation is at `/docs`.

- `GET /api/v1/campaigns` — paginated search and active/successful/failed/completed filters.
- `GET /api/v1/campaigns/{id}` — campaign detail and reward tiers.
- `GET /api/v1/campaigns/{id}/activity` — finalized event history with transaction/block references.
- `GET /api/v1/users/{address}/activity` — created campaigns, contribution aggregates, and event history.
- `GET /api/v1/health/live` — process liveness only.
- `GET /api/v1/health/ready` — database, RPC, indexer, lag, and staleness readiness.

All endpoints are public and read-only. Authentication would not protect a privileged operation in this phase, so wallet signatures and sessions are intentionally absent. Add authentication only if a later phase introduces user-private or operator-only actions.

CORS uses an explicit allowlist. Expensive endpoints use a bounded in-process fixed-window limiter. `memory://` is appropriate for one process; configure and implement a Redis-backed shared limiter before horizontal production scaling. No Redis client is included merely for appearance.

## Tests and quality

```sh
uv run ruff format --check .
uv run ruff check .
uv run mypy src
uv run pytest -q
```

The deterministic suite uses SQLite and mocked RPC data. The opt-in integration test launches Anvil, deploys the actual contracts, creates a campaign, and indexes the emitted event:

```sh
RUN_ANVIL_TESTS=1 uv run pytest -q tests/integration/test_anvil_indexer.py
```

Public RPC calls are never required in tests.

## Deployment and monitoring

Run migrations once per release, API processes separately from one active indexer per chain/contract, and use PostgreSQL backups. Alert on:

- `/health/ready` returning 503;
- `status != healthy`, increasing `lag_blocks`, or stale `last_success_at`;
- repeated RPC timeout/rate-limit errors;
- reorganization reconciliation warnings;
- database storage and connection saturation.

Use structured JSON logs and centralized redaction. The service logs operational identifiers, never environment values, RPC credentials, database passwords, or private keys.

## Known limitations

- Search uses indexed SQL text matching; production scale may warrant PostgreSQL full-text indexes.
- The API is eventually consistent by the configured confirmation depth and polling interval.
- In-process rate limiting is not shared across replicas.
- A reorganization deeper than `MAX_REORG_DEPTH` requires operator-directed resynchronization.
- Event projections are reconciled against canonical block hashes and replayed events; they do not replace direct contract reads for financial eligibility.
