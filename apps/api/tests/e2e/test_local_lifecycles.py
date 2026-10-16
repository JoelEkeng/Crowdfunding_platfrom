import json
import os
import socket
import subprocess
import time
from decimal import Decimal
from pathlib import Path

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from fundchain.app import create_app
from fundchain.config import Settings
from fundchain.indexer.service import build_indexer
from fundchain.models import Campaign

pytestmark = pytest.mark.integration
LOCAL_DEPLOYER_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"


def run(
    command: list[str],
    *,
    cwd: Path | None = None,
    check: bool = True,
    env: dict[str, str] | None = None,
) -> subprocess.CompletedProcess:
    return subprocess.run(command, cwd=cwd, check=check, capture_output=True, text=True, env=env)


def send(rpc: str, sender: str, contract: str, signature: str, *args: str, check: bool = True):
    return run(
        [
            "cast",
            "send",
            contract,
            signature,
            *args,
            "--from",
            sender,
            "--unlocked",
            "--rpc-url",
            rpc,
        ],
        check=check,
    )


@pytest.mark.skipif(os.getenv("RUN_E2E_TESTS") != "1", reason="set RUN_E2E_TESTS=1")
@pytest.mark.asyncio
async def test_successful_and_failed_campaigns_end_to_end(
    session_factory: async_sessionmaker[AsyncSession],
) -> None:
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
    root = Path(__file__).resolve().parents[4]
    contracts = root / "packages" / "contracts"
    rpc = f"http://127.0.0.1:{port}"
    anvil = subprocess.Popen(["anvil", "--silent", "--port", str(port)])
    try:
        time.sleep(1)
        run(
            [
                "forge",
                "script",
                "script/DeployLocal.s.sol:DeployLocal",
                "--rpc-url",
                rpc,
                "--broadcast",
            ],
            cwd=contracts,
            check=True,
            env={**os.environ, "DEPLOYER_PRIVATE_KEY": LOCAL_DEPLOYER_KEY},
        )
        broadcast = json.loads(
            (
                contracts / "broadcast" / "DeployLocal.s.sol" / "31337" / "run-latest.json"
            ).read_text()
        )
        crowdfunding = next(
            item["contractAddress"]
            for item in broadcast["transactions"]
            if item.get("contractName") == "Crowdfunding"
        )
        token = next(
            item["contractAddress"]
            for item in broadcast["transactions"]
            if item.get("contractName") == "MockERC20"
        )
        accounts = json.loads(run(["cast", "rpc", "eth_accounts", "--rpc-url", rpc]).stdout)
        creator, alice, bob, empty = accounts[:4]
        for supporter in (alice, bob):
            send(rpc, creator, token, "mint(address,uint256)", supporter, "1000")
            send(rpc, supporter, token, "approve(address,uint256)", crowdfunding, "1000")

        deadline = int(time.time()) + 7_200
        create_signature = (
            "createCampaign(string,string,string,uint256,address,uint256,(uint256,string)[])"
        )
        send(
            rpc,
            creator,
            crowdfunding,
            create_signature,
            "Successful campaign",
            "Goal reached by multiple supporters",
            "",
            "100",
            token,
            str(deadline),
            "[]",
        )
        send(
            rpc,
            creator,
            crowdfunding,
            create_signature,
            "Failed campaign",
            "Goal remains below target",
            "",
            "1000",
            token,
            str(deadline),
            "[]",
        )
        send(rpc, alice, crowdfunding, "pledge(uint256,uint256,uint256)", "1", "60", "0")
        send(rpc, bob, crowdfunding, "pledge(uint256,uint256,uint256)", "1", "50", "0")
        send(rpc, alice, crowdfunding, "pledge(uint256,uint256,uint256)", "2", "20", "0")
        send(rpc, bob, crowdfunding, "pledge(uint256,uint256,uint256)", "2", "20", "0")

        assert (
            send(rpc, alice, crowdfunding, "claimFunds(uint256)", "1", check=False).returncode != 0
        )
        assert (
            send(
                rpc,
                empty,
                crowdfunding,
                "pledge(uint256,uint256,uint256)",
                "1",
                "1",
                "0",
                check=False,
            ).returncode
            != 0
        )

        run(["cast", "rpc", "evm_increaseTime", "7201", "--rpc-url", rpc])
        run(["cast", "rpc", "evm_mine", "--rpc-url", rpc])
        assert (
            send(
                rpc,
                alice,
                crowdfunding,
                "pledge(uint256,uint256,uint256)",
                "1",
                "1",
                "0",
                check=False,
            ).returncode
            != 0
        )

        send(rpc, creator, crowdfunding, "claimFunds(uint256)", "1")
        assert (
            send(rpc, creator, crowdfunding, "claimFunds(uint256)", "1", check=False).returncode
            != 0
        )
        assert (
            send(rpc, alice, crowdfunding, "claimRefund(uint256)", "1", check=False).returncode != 0
        )
        assert (
            send(rpc, creator, crowdfunding, "claimFunds(uint256)", "2", check=False).returncode
            != 0
        )
        send(rpc, alice, crowdfunding, "claimRefund(uint256)", "2")
        send(rpc, bob, crowdfunding, "claimRefund(uint256)", "2")
        assert (
            send(rpc, alice, crowdfunding, "claimRefund(uint256)", "2", check=False).returncode != 0
        )

        settings = Settings(
            database_url="sqlite+aiosqlite://",
            rpc_url=rpc,
            chain_id=31337,
            crowdfunding_contract_address=crowdfunding,
            indexer_start_block=0,
            confirmation_depth=0,
            indexer_block_range=500,
            cors_origins=["http://localhost:3000"],
        )
        indexer = build_indexer(settings, session_factory)
        await indexer.sync_once()
        async with session_factory() as session:
            successful = await session.get(Campaign, Decimal(1))
            failed = await session.get(Campaign, Decimal(2))
            assert successful and successful.total_pledged == 110
            assert successful.funds_claimed and successful.total_refunded == 0
            assert failed and failed.total_pledged == 40
            assert failed.total_refunded == 40 and not failed.funds_claimed

        app = create_app(settings, session_factory=session_factory, rpc=indexer.rpc)
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            success_response = await client.get(
                "/api/v1/campaigns", params={"status": "successful"}
            )
            failure_response = await client.get("/api/v1/campaigns", params={"status": "failed"})
            assert success_response.json()["items"][0]["campaign_id"] == "1"
            assert failure_response.json()["items"][0]["campaign_id"] == "2"
            assert success_response.json()["index"]["complete"] is True
    finally:
        anvil.terminate()
        anvil.wait(timeout=5)
