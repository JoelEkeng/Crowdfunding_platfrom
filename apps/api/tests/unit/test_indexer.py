from decimal import Decimal

import pytest
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from fundchain.config import Settings
from fundchain.indexer.service import EventIndexer
from fundchain.models import Campaign, CampaignEvent, IndexedBlock, IndexerState
from tests.helpers import FakeRPC, block, decode_fake, event


def make_indexer(
    settings: Settings,
    factory: async_sessionmaker[AsyncSession],
    rpc: FakeRPC,
) -> EventIndexer:
    return EventIndexer(settings, factory, rpc, decode_fake)


@pytest.mark.asyncio
async def test_confirmation_depth_and_restart_recovery(
    settings: Settings, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    rpc = FakeRPC(5, [event("CampaignCreated", 1), event("Pledged", 3, amount=25)])
    indexer = make_indexer(settings, session_factory, rpc)
    assert await indexer.sync_once() == 3
    async with session_factory() as session:
        state = await session.get(IndexerState, 1)
        assert state and state.last_finalized_block == 3
        assert await session.scalar(select(func.count()).select_from(IndexedBlock)) == 3
        campaign = await session.get(Campaign, Decimal(1))
        assert campaign and campaign.total_pledged == 25

    rpc.head = 7
    restarted = make_indexer(settings, session_factory, rpc)
    assert await restarted.sync_once() == 2
    async with session_factory() as session:
        state = await session.get(IndexerState, 1)
        assert state and state.last_finalized_block == 5


@pytest.mark.asyncio
async def test_duplicate_logs_do_not_double_count(
    settings: Settings, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    rpc = FakeRPC(4, [event("CampaignCreated", 1), event("Pledged", 2, amount=40)])
    indexer = make_indexer(settings, session_factory, rpc)
    await indexer.sync_once()
    async with session_factory.begin() as session:
        state = await session.get(IndexerState, 1)
        assert state
        state.last_finalized_block = None
        state.last_finalized_hash = None
    await indexer.sync_once()
    async with session_factory() as session:
        campaign = await session.get(Campaign, Decimal(1))
        assert campaign and campaign.total_pledged == 40
        assert await session.scalar(select(func.count()).select_from(CampaignEvent)) == 2


@pytest.mark.asyncio
async def test_database_transaction_rolls_back_malformed_range(
    settings: Settings, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    rpc = FakeRPC(3, [event("Pledged", 1, amount=5)])
    indexer = make_indexer(settings, session_factory, rpc)
    with pytest.raises(RuntimeError, match="unknown campaign"):
        await indexer.sync_once()
    async with session_factory() as session:
        state = await session.get(IndexerState, 1)
        assert state and state.last_finalized_block is None and state.status == "degraded"
        assert await session.scalar(select(func.count()).select_from(CampaignEvent)) == 0
        assert await session.scalar(select(func.count()).select_from(IndexedBlock)) == 0


@pytest.mark.asyncio
async def test_rpc_failure_does_not_advance_checkpoint(
    settings: Settings, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    rpc = FakeRPC(3, [])
    rpc.fail = True
    indexer = make_indexer(settings, session_factory, rpc)
    with pytest.raises(TimeoutError):
        await indexer.sync_once()
    async with session_factory() as session:
        state = await session.get(IndexerState, 1)
        assert state and state.status == "degraded" and state.last_finalized_block is None
        assert "RPC unavailable" in (state.last_error or "")


@pytest.mark.asyncio
async def test_reorganization_rebuilds_derived_totals(
    settings: Settings, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    rpc = FakeRPC(5, [event("CampaignCreated", 1), event("Pledged", 3, amount=25)])
    indexer = make_indexer(settings, session_factory, rpc)
    await indexer.sync_once()

    rpc.branch_by_block[3] = "b"
    rpc.events = [event("CampaignCreated", 1), event("Pledged", 3, amount=7, branch="b")]
    await indexer.sync_once()
    async with session_factory() as session:
        campaign = await session.get(Campaign, Decimal(1))
        state = await session.get(IndexerState, 1)
        assert campaign and campaign.total_pledged == 7
        assert state and state.last_finalized_hash == block(3, "b").hash
