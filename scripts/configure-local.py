#!/usr/bin/env python3
import argparse
import json
import subprocess
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser(description="Align FundChain local API and web configuration")
    parser.add_argument("--rpc-url", default="http://127.0.0.1:8545")
    parser.add_argument(
        "--database-url",
        default="postgresql+asyncpg://fundchain:local-development-only@127.0.0.1:5432/fundchain",
    )
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    broadcast_path = (
        root
        / "packages"
        / "contracts"
        / "broadcast"
        / "DeployLocal.s.sol"
        / "31337"
        / "run-latest.json"
    )
    if not broadcast_path.exists():
        raise SystemExit("Local deployment receipt not found; run DeployLocal.s.sol with --broadcast first")
    broadcast = json.loads(broadcast_path.read_text())
    deployments = {
        item.get("contractName"): item
        for item in broadcast["transactions"]
        if item.get("contractAddress")
    }
    crowdfunding = deployments.get("Crowdfunding")
    token = deployments.get("MockERC20")
    if not crowdfunding or not token:
        raise SystemExit("Broadcast does not contain both Crowdfunding and MockERC20 deployments")
    receipt = json.loads(
        subprocess.run(
            ["cast", "receipt", crowdfunding["hash"], "--rpc-url", args.rpc_url, "--json"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout
    )
    block_value = receipt["blockNumber"]
    deployment_block = int(block_value, 16) if isinstance(block_value, str) else block_value
    (root / "apps" / "api" / ".env").write_text(
        "\n".join(
            [
                f"DATABASE_URL={args.database_url}",
                f"RPC_URL={args.rpc_url}",
                "CHAIN_ID=31337",
                f"CROWDFUNDING_CONTRACT_ADDRESS={crowdfunding['contractAddress']}",
                f"INDEXER_START_BLOCK={deployment_block}",
                "CONFIRMATION_DEPTH=0",
                "INDEXER_BLOCK_RANGE=500",
                "INDEXER_POLL_SECONDS=2",
                "INDEXER_RPC_RETRIES=4",
                "INDEXER_STALE_AFTER_SECONDS=30",
                "MAX_REORG_DEPTH=100",
                "API_HOST=127.0.0.1",
                "API_PORT=8000",
                "API_PREFIX=/api/v1",
                "CORS_ORIGINS=http://localhost:3000",
                "RATE_LIMIT_REQUESTS=300",
                "RATE_LIMIT_WINDOW_SECONDS=60",
                "RATE_LIMIT_STORAGE_URL=memory://",
                "LOG_LEVEL=INFO",
                "",
            ]
        )
    )
    (root / "apps" / "web" / ".env.local").write_text(
        "\n".join(
            [
                "NEXT_PUBLIC_CHAIN_ID=31337",
                f"NEXT_PUBLIC_RPC_URL={args.rpc_url}",
                "NEXT_PUBLIC_API_URL=http://localhost:8000",
                f"NEXT_PUBLIC_CROWDFUNDING_ADDRESS={crowdfunding['contractAddress']}",
                f"NEXT_PUBLIC_DEPLOYMENT_BLOCK={deployment_block}",
                "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=",
                f"NEXT_PUBLIC_TOKEN_ADDRESS={token['contractAddress']}",
                "NEXT_PUBLIC_TOKEN_SYMBOL=FCT",
                "NEXT_PUBLIC_TOKEN_DECIMALS=18",
                "",
            ]
        )
    )
    print(f"Configured local FundChain at {crowdfunding['contractAddress']}")
    print(f"Mock token: {token['contractAddress']}")
    print(f"Indexer start block: {deployment_block}")


if __name__ == "__main__":
    main()
