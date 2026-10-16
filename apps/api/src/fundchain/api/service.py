from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from fundchain.config import Settings
from fundchain.models import IndexedBlock, IndexerState
from fundchain.schemas import IndexedMetadata


async def indexed_chain_time(session: AsyncSession) -> datetime:
    value = await session.scalar(
        select(IndexedBlock.timestamp).order_by(IndexedBlock.block_number.desc()).limit(1)
    )
    if value is None:
        return datetime.now(UTC)
    return value if value.tzinfo else value.replace(tzinfo=UTC)


async def index_metadata(
    session: AsyncSession, settings: Settings, *, require_complete: bool = False
) -> IndexedMetadata:
    state = await session.get(IndexerState, 1)
    now = datetime.now(UTC)
    stale = True
    if state and state.last_success_at:
        last_success = (
            state.last_success_at
            if state.last_success_at.tzinfo
            else state.last_success_at.replace(tzinfo=UTC)
        )
        stale = (now - last_success).total_seconds() > settings.indexer_stale_after_seconds
    complete = bool(
        state
        and state.last_finalized_block is not None
        and state.safe_head is not None
        and state.last_finalized_block >= state.safe_head
        and state.status == "healthy"
        and not stale
    )
    return IndexedMetadata(
        indexed_through_block=state.last_finalized_block if state else None,
        safe_head=state.safe_head if state else None,
        observed_head=state.observed_head if state else None,
        confirmation_depth=settings.confirmation_depth,
        stale=stale,
        complete=complete,
    )
