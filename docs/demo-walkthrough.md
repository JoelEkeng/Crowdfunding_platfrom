# Portfolio demo walkthrough

Use only the local Anvil deployment and synthetic campaign content.

1. **Architecture (45 seconds):** show `docs/architecture.md`; explain that wallets transact with Solidity while finalized logs feed PostgreSQL discovery.
2. **Security boundary (30 seconds):** point out that FastAPI has no signing key and cannot authorize claims or refunds.
3. **Create (60 seconds):** connect an isolated Anvil wallet, launch “Open-source accessibility toolkit,” and wait for the receipt-confirmed state.
4. **Index (30 seconds):** show `/api/v1/health/ready`, then search for the campaign through the discovery page after the indexer checkpoint advances.
5. **Pledge (60 seconds):** use two synthetic supporter wallets, demonstrate the separate ERC-20 approval and pledge receipts, and show updated contract progress.
6. **Settlement (60 seconds):** run the automated E2E test or use `evm_increaseTime` only on Anvil; demonstrate a successful creator claim and failed-campaign supporter refund.
7. **Failure evidence (30 seconds):** show duplicate claim/refund and post-deadline pledge reverts in the E2E test output.
8. **QA (30 seconds):** show Foundry invariants, frontend build/tests, backend type/lint tests, and real Anvil E2E results.
9. **Limitations (30 seconds):** explicitly state no professional audit, no production readiness claim, and no verified public testnet deployment yet.

Do not display `.env`, shell history containing keys, seed phrases, RPC credentials, or fabricated explorer screenshots.
