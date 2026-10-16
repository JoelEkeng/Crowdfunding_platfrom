import asyncio
from collections.abc import Callable
from datetime import UTC, datetime
from decimal import Decimal
from functools import partial
from typing import Any

import structlog
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from fundchain.config import Settings
from fundchain.indexer.projections import apply_event, rebuild_projections
from fundchain.indexer.rpc import Web3RPCClient
from fundchain.indexer.types import BlockData, DecodedEvent, RPCClient
from fundchain.models import CampaignEvent, IndexedBlock, IndexerState

log = structlog.get_logger()


class ChainMismatchError(RuntimeError):
    pass


class ReorgTooDeepError(RuntimeError):
    pass


class EventIndexer:
    def __init__(
        self,
        settings: Settings,
        session_factory: async_sessionmaker[AsyncSession],
        rpc: RPCClient,
        decoder: Callable[[dict[str, Any]], DecodedEvent],
    ) -> None:
        self.settings = settings
        self.session_factory = session_factory
        self.rpc = rpc
        self.decoder = decoder

    async def _retry(self, operation: Callable[[], Any]) -> Any:
        delay = 0.25
        for attempt in range(self.settings.indexer_rpc_retries):
            try:
                return await operation()
            except Exception:
                if attempt + 1 == self.settings.indexer_rpc_retries:
                    raise
                await asyncio.sleep(delay)
                delay = min(delay * 2, 5)
        raise AssertionError("unreachable")

    async def _state(self, session: AsyncSession) -> IndexerState:
        state = await session.get(IndexerState, 1)
        if state is None:
            state = IndexerState(
                id=1,
                chain_id=self.settings.chain_id,
                contract_address=self.settings.crowdfunding_contract_address,
                status="starting",
            )
            session.add(state)
            await session.flush()
        return state

    async def sync_once(self) -> int:
        try:
            chain_id = await self._retry(self.rpc.chain_id)
            if chain_id != self.settings.chain_id:
                raise ChainMismatchError(
                    f"RPC chain ID {chain_id} does not match configured {self.settings.chain_id}"
                )
            head = await self._retry(self.rpc.block_number)
            safe_head = head - self.settings.confirmation_depth
            async with self.session_factory.begin() as session:
                state = await self._state(session)
                state.observed_head = head
                state.safe_head = safe_head
                state.status = "syncing"
                state.updated_at = datetime.now(UTC)
            await self._reconcile_reorg()
            if safe_head < self.settings.indexer_start_block:
                await self._mark_success(head, safe_head)
                return 0
            processed = 0
            while True:
                async with self.session_factory() as session:
                    state = await self._state(session)
                    next_block = (
                        state.last_finalized_block + 1
                        if state.last_finalized_block is not None
                        else self.settings.indexer_start_block
                    )
                if next_block > safe_head:
                    break
                end = min(next_block + self.settings.indexer_block_range - 1, safe_head)
                blocks = [
                    await self._retry(partial(self.rpc.get_block, number))
                    for number in range(next_block, end + 1)
                ]
                raw_logs = await self._retry(partial(self.rpc.get_logs, next_block, end))
                events = sorted(
                    (self.decoder(item) for item in raw_logs),
                    key=lambda item: (item.block_number, item.transaction_index, item.log_index),
                )
                await self._persist_range(blocks, events, head, safe_head)
                processed += len(blocks)
            await self._mark_success(head, safe_head)
            return processed
        except Exception as exc:
            await self._mark_failure(exc)
            raise

    async def _persist_range(
        self,
        blocks: list[BlockData],
        events: list[DecodedEvent],
        head: int,
        safe_head: int,
    ) -> None:
        block_map = {block.number: block for block in blocks}
        async with self.session_factory.begin() as session:
            state = await self._state(session)
            expected = (
                state.last_finalized_block + 1
                if state.last_finalized_block is not None
                else self.settings.indexer_start_block
            )
            if not blocks or blocks[0].number != expected:
                raise RuntimeError("checkpoint changed while persisting range")
            if state.last_finalized_hash and blocks[0].parent_hash != state.last_finalized_hash:
                raise RuntimeError("first block does not extend the finalized checkpoint")
            for previous, current in zip(blocks, blocks[1:], strict=False):
                if current.parent_hash != previous.hash:
                    raise RuntimeError("non-contiguous block range returned by RPC")
            for block in blocks:
                stored_block = await session.get(
                    IndexedBlock, (self.settings.chain_id, block.number)
                )
                if stored_block is not None:
                    if stored_block.block_hash != block.hash:
                        raise RuntimeError("block hash changed while persisting range")
                    continue
                session.add(
                    IndexedBlock(
                        chain_id=self.settings.chain_id,
                        block_number=block.number,
                        block_hash=block.hash,
                        parent_hash=block.parent_hash,
                        timestamp=block.timestamp,
                    )
                )
            for event in events:
                duplicate = await session.scalar(
                    select(CampaignEvent.id).where(
                        CampaignEvent.chain_id == self.settings.chain_id,
                        CampaignEvent.contract_address
                        == self.settings.crowdfunding_contract_address,
                        CampaignEvent.transaction_hash == event.transaction_hash,
                        CampaignEvent.log_index == event.log_index,
                    )
                )
                if duplicate is not None:
                    continue
                block = block_map[event.block_number]
                session.add(
                    CampaignEvent(
                        chain_id=self.settings.chain_id,
                        contract_address=self.settings.crowdfunding_contract_address,
                        transaction_hash=event.transaction_hash,
                        log_index=event.log_index,
                        block_number=event.block_number,
                        block_hash=event.block_hash,
                        transaction_index=event.transaction_index,
                        event_type=event.event_type,
                        campaign_id=Decimal(event.campaign_id),
                        actor=event.actor,
                        amount=Decimal(event.amount) if event.amount is not None else None,
                        tier_id=Decimal(event.tier_id) if event.tier_id is not None else None,
                        payload=event.payload,
                        block_timestamp=block.timestamp,
                    )
                )
                await apply_event(session, event, block.timestamp)
                await session.flush()
            last = blocks[-1]
            state.last_finalized_block = last.number
            state.last_finalized_hash = last.hash
            state.observed_head = head
            state.safe_head = safe_head
            state.status = "syncing"
            state.last_error = None

    async def _reconcile_reorg(self) -> None:
        async with self.session_factory() as session:
            state = await self._state(session)
            checkpoint = state.last_finalized_block
            checkpoint_hash = state.last_finalized_hash
        if checkpoint is None or checkpoint_hash is None:
            return
        remote = await self._retry(lambda: self.rpc.get_block(checkpoint))
        if remote.hash == checkpoint_hash:
            return
        lower = max(
            self.settings.indexer_start_block - 1, checkpoint - self.settings.max_reorg_depth
        )
        ancestor: int | None = None
        async with self.session_factory() as session:
            for number in range(checkpoint - 1, lower - 1, -1):
                stored = await session.get(IndexedBlock, (self.settings.chain_id, number))
                if stored is None:
                    continue
                candidate = await self._retry(partial(self.rpc.get_block, number))
                if candidate.hash == stored.block_hash:
                    ancestor = number
                    break
        if ancestor is None and lower >= self.settings.indexer_start_block:
            raise ReorgTooDeepError("no common ancestor found within configured reorg depth")
        await self.resync_from(
            (ancestor + 1) if ancestor is not None else self.settings.indexer_start_block
        )
        log.warning("chain_reorganization_reconciled", common_ancestor=ancestor)

    async def resync_from(self, from_block: int) -> None:
        if from_block < self.settings.indexer_start_block:
            raise ValueError("resync block precedes configured start block")
        async with self.session_factory.begin() as session:
            await session.execute(
                delete(CampaignEvent).where(CampaignEvent.block_number >= from_block)
            )
            await session.execute(
                delete(IndexedBlock).where(
                    IndexedBlock.chain_id == self.settings.chain_id,
                    IndexedBlock.block_number >= from_block,
                )
            )
            await rebuild_projections(session)
            state = await self._state(session)
            previous = await session.scalar(
                select(IndexedBlock)
                .where(
                    IndexedBlock.chain_id == self.settings.chain_id,
                    IndexedBlock.block_number < from_block,
                )
                .order_by(IndexedBlock.block_number.desc())
                .limit(1)
            )
            state.last_finalized_block = previous.block_number if previous else None
            state.last_finalized_hash = previous.block_hash if previous else None
            state.status = "resyncing"
            state.last_error = None

    async def _mark_success(self, head: int, safe_head: int) -> None:
        async with self.session_factory.begin() as session:
            state = await self._state(session)
            state.observed_head = head
            state.safe_head = safe_head
            state.status = "healthy"
            state.last_error = None
            state.last_success_at = datetime.now(UTC)

    async def _mark_failure(self, error: Exception) -> None:
        async with self.session_factory.begin() as session:
            state = await self._state(session)
            state.status = "degraded"
            state.last_error = str(error)[:2000]
            state.updated_at = datetime.now(UTC)


async def run_forever(indexer: EventIndexer, poll_seconds: float) -> None:
    while True:
        try:
            await indexer.sync_once()
        except Exception:
            log.exception("indexer_iteration_failed")
        await asyncio.sleep(poll_seconds)


def build_indexer(
    settings: Settings, session_factory: async_sessionmaker[AsyncSession]
) -> EventIndexer:
    rpc = Web3RPCClient(settings.rpc_url, settings.crowdfunding_contract_address)
    return EventIndexer(settings, session_factory, rpc, rpc.decode_log)
