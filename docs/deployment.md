# Deployment guide

## Local deployment

1. Start PostgreSQL from `apps/api` with `docker compose up -d postgres` or provide an equivalent PostgreSQL 17 instance.
2. Start `anvil` and keep its output private to the isolated local environment.
3. Copy a displayed Anvil development key into the shell only:

```sh
export DEPLOYER_PRIVATE_KEY=<isolated-anvil-key>
cd packages/contracts
forge script script/DeployLocal.s.sol:DeployLocal \
  --rpc-url http://127.0.0.1:8545 --broadcast
cd ../..
python3 scripts/configure-local.py
```

The configuration script reads the real broadcast receipt and writes `apps/api/.env` and `apps/web/.env.local`. Both are ignored by Git. It does not contain or write a private key.

Apply migrations and start each process in a separate terminal:

```sh
cd apps/api
uv sync --dev
uv run alembic upgrade head
uv run python -m fundchain.indexer.worker
uv run uvicorn fundchain.main:app --host 127.0.0.1 --port 8000
```

```sh
cd apps/web
pnpm install
pnpm dev
```

Add an isolated wallet network with RPC `http://127.0.0.1:8545`, chain ID `31337`, symbol `ETH`, and import only an Anvil development account. Never reuse that key on a public network.

## Sepolia preparation

Selected testnet: Ethereum Sepolia, chain ID `11155111`.

Prerequisites:

- dedicated test wallet containing no valuable assets;
- Sepolia ETH from a trusted faucet selected by the operator;
- HTTPS Sepolia RPC checked with `cast chain-id --rpc-url "$RPC_URL"`;
- explorer API key kept server-side;
- reviewed existing test token, or explicit acknowledgement of a testnet-only mock.

For an existing token:

```sh
cd packages/contracts
export EXPECTED_CHAIN_ID=11155111
export TOKEN_ADDRESS=0x...
forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL"
forge script script/Deploy.s.sol:Deploy --rpc-url "$RPC_URL" --broadcast
```

If no suitable token exists, use the explicit mock path:

```sh
export EXPECTED_CHAIN_ID=11155111
export ALLOW_TESTNET_MOCK_TOKEN=true
forge script script/DeployTestnetMock.s.sol:DeployTestnetMock --rpc-url "$RPC_URL"
forge script script/DeployTestnetMock.s.sol:DeployTestnetMock --rpc-url "$RPC_URL" --broadcast
```

Record chain ID, deployment block, token and crowdfunding addresses, deployment transaction hashes, compiler version, and explorer URLs. Verify source using the commands in `packages/contracts/README.md`. Independently confirm bytecode and constructor arguments with a second RPC/explorer before configuring applications.

Set backend `CHAIN_ID`, `RPC_URL`, `CROWDFUNDING_CONTRACT_ADDRESS`, and `INDEXER_START_BLOCK` from the verified receipt. Set frontend chain, RPC, API, explorer, contract, deployment block, token address, symbol, and decimals to the same deployment. Configure backend `CORS_ORIGINS` to the exact frontend origin.

## Current public deployment status

No Sepolia deployment was performed in Prompt 5. This environment had no approved dedicated testnet private key, funded account, RPC credential, or faucet authorization. Therefore there are no legitimate addresses, transaction hashes, or explorer links to report. Mainnet deployment is explicitly out of scope.
