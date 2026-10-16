import json
import os
import socket
import subprocess
import time
from pathlib import Path

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from fundchain.config import Settings
from fundchain.indexer.service import build_indexer
from fundchain.models import Campaign

pytestmark = pytest.mark.integration


@pytest.mark.skipif(os.getenv("RUN_ANVIL_TESTS") != "1", reason="set RUN_ANVIL_TESTS=1")
@pytest.mark.asyncio
async def test_indexes_local_deployment_end_to_end(
    session_factory: async_sessionmaker[AsyncSession], tmp_path: Path
) -> None:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    root = Path(__file__).resolve().parents[4]
    contracts = root / "packages" / "contracts"
    rpc_url = f"http://127.0.0.1:{port}"
    anvil = subprocess.Popen(["anvil", "--silent", "--port", str(port)])
    try:
        time.sleep(1)
        env = {
            **os.environ,
            "DEPLOYER_PRIVATE_KEY": (
                "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
            ),
        }
        subprocess.run(
            [
                "forge",
                "script",
                "script/DeployLocal.s.sol:DeployLocal",
                "--rpc-url",
                rpc_url,
                "--broadcast",
            ],
            cwd=contracts,
            env=env,
            check=True,
            capture_output=True,
            text=True,
        )
        broadcast = json.loads(
            (
                contracts / "broadcast" / "DeployLocal.s.sol" / "31337" / "run-latest.json"
            ).read_text()
        )
        contract = next(
            item["contractAddress"]
            for item in broadcast["transactions"]
            if item.get("contractName") == "Crowdfunding"
        )
        token = next(
            item["contractAddress"]
            for item in broadcast["transactions"]
            if item.get("contractName") == "MockERC20"
        )
        subprocess.run(
            [
                "cast",
                "send",
                contract,
                "createCampaign(string,string,string,uint256,address,uint256,(uint256,string)[])",
                "Indexed campaign",
                "Anvil integration test",
                "",
                "100",
                token,
                str(int(time.time()) + 86_400),
                "[]",
                "--private-key",
                env["DEPLOYER_PRIVATE_KEY"],
                "--rpc-url",
                rpc_url,
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        settings = Settings(
            database_url="sqlite+aiosqlite://",
            rpc_url=rpc_url,
            chain_id=31337,
            crowdfunding_contract_address=contract,
            indexer_start_block=0,
            confirmation_depth=0,
            indexer_block_range=100,
        )
        indexer = build_indexer(settings, session_factory)
        assert await indexer.sync_once() > 0
        async with session_factory() as session:
            assert await session.scalar(select(func.count()).select_from(Campaign)) == 1
    finally:
        anvil.terminate()
        anvil.wait(timeout=5)
