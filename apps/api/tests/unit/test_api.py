from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from fundchain.models import Campaign, CampaignEvent, IndexerState, SupporterPledge
from tests.helpers import CREATOR, SUPPORTER, TOKEN


async def seed(factory: async_sessionmaker[AsyncSession], *, stale: bool = False) -> None:
    now = datetime.now(UTC)
    async with factory.begin() as session:
        session.add_all(
            [
                Campaign(
                    campaign_id=Decimal(1),
                    creator=CREATOR,
                    token=TOKEN,
                    goal=Decimal(100),
                    deadline=now + timedelta(days=2),
                    title="Open wallet",
                    description="Privacy infrastructure",
                    image_uri="",
                    total_pledged=Decimal(20),
                    total_refunded=Decimal(0),
                    funds_claimed=False,
                    created_block=10,
                    created_tx_hash="0x" + "01" * 32,
                    created_at=now,
                ),
                Campaign(
                    campaign_id=Decimal(2),
                    creator=CREATOR,
                    token=TOKEN,
                    goal=Decimal(100),
                    deadline=now - timedelta(days=2),
                    title="Public goods",
                    description="Developer tooling",
                    image_uri="",
                    total_pledged=Decimal(100),
                    total_refunded=Decimal(0),
                    funds_claimed=False,
                    created_block=11,
                    created_tx_hash="0x" + "02" * 32,
                    created_at=now,
                ),
                Campaign(
                    campaign_id=Decimal(3),
                    creator="0x5555555555555555555555555555555555555555",
                    token=TOKEN,
                    goal=Decimal(100),
                    deadline=now - timedelta(days=1),
                    title="Failed experiment",
                    description="Research",
                    image_uri="",
                    total_pledged=Decimal(10),
                    total_refunded=Decimal(0),
                    funds_claimed=False,
                    created_block=12,
                    created_tx_hash="0x" + "03" * 32,
                    created_at=now,
                ),
            ]
        )
        session.add(
            SupporterPledge(
                campaign_id=Decimal(1),
                supporter=SUPPORTER,
                gross_pledged=Decimal(20),
                refunded=Decimal(0),
                updated_block=13,
            )
        )
        session.add(
            CampaignEvent(
                chain_id=31337,
                contract_address="0x1111111111111111111111111111111111111111",
                transaction_hash="0x" + "04" * 32,
                log_index=0,
                block_number=13,
                block_hash="0x" + "13" * 32,
                transaction_index=0,
                event_type="Pledged",
                campaign_id=Decimal(1),
                actor=SUPPORTER,
                amount=Decimal(20),
                tier_id=Decimal(0),
                payload={"campaignId": "1", "supporter": SUPPORTER, "amount": "20", "tierId": "0"},
                block_timestamp=now,
            )
        )
        session.add(
            IndexerState(
                id=1,
                chain_id=31337,
                contract_address="0x1111111111111111111111111111111111111111",
                last_finalized_block=20,
                last_finalized_hash="0x" + "20" * 32,
                observed_head=22,
                safe_head=20,
                status="healthy",
                last_error=None,
                last_success_at=now - timedelta(minutes=10) if stale else now,
                updated_at=now,
            )
        )


@pytest.mark.asyncio
async def test_campaign_pagination_search_and_filters(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    await seed(session_factory)
    response = await client.get("/api/v1/campaigns", params={"page": 1, "page_size": 2})
    assert response.status_code == 200
    assert response.json()["total"] == 3
    assert len(response.json()["items"]) == 2
    assert response.json()["items"][0]["campaign_id"] == "3"

    searched = await client.get("/api/v1/campaigns", params={"search": "privacy"})
    assert searched.json()["total"] == 1
    assert searched.json()["items"][0]["title"] == "Open wallet"

    successful = await client.get("/api/v1/campaigns", params={"status": "successful"})
    assert [item["campaign_id"] for item in successful.json()["items"]] == ["2"]
    failed = await client.get("/api/v1/campaigns", params={"status": "failed"})
    assert [item["campaign_id"] for item in failed.json()["items"]] == ["3"]


@pytest.mark.asyncio
async def test_invalid_parameters_and_missing_campaign(client: AsyncClient) -> None:
    assert (await client.get("/api/v1/campaigns", params={"page_size": 101})).status_code == 422
    assert (await client.get("/api/v1/campaigns", params={"status": "invented"})).status_code == 422
    assert (await client.get("/api/v1/campaigns/0")).status_code == 422
    assert (await client.get("/api/v1/campaigns/999")).status_code == 404


@pytest.mark.asyncio
async def test_campaign_activity_and_user_index(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    await seed(session_factory)
    activity = await client.get("/api/v1/campaigns/1/activity")
    assert activity.status_code == 200
    assert activity.json()["items"][0]["transaction_hash"] == "0x" + "04" * 32
    user = await client.get(f"/api/v1/users/{SUPPORTER}/activity")
    assert user.status_code == 200
    assert user.json()["contributed"][0]["gross_pledged"] == "20"
    assert user.json()["index"]["source"] == "finalized_index"
    assert (await client.get("/api/v1/users/not-an-address/activity")).status_code == 422


@pytest.mark.asyncio
async def test_stale_index_is_reported_honestly(
    client: AsyncClient, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    await seed(session_factory, stale=True)
    campaigns = await client.get("/api/v1/campaigns")
    assert campaigns.json()["index"]["stale"] is True
    assert campaigns.json()["index"]["complete"] is False
    ready = await client.get("/api/v1/health/ready")
    assert ready.status_code == 503
    assert ready.json()["status"] == "degraded"
    assert (await client.get("/api/v1/health/live")).status_code == 200
