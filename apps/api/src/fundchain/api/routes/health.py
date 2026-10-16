import asyncio
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from fundchain.api.dependencies import get_app_settings, get_session
from fundchain.config import Settings
from fundchain.models import IndexerState
from fundchain.schemas import LiveHealth, ReadyHealth

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live", response_model=LiveHealth)
async def live() -> LiveHealth:
    return LiveHealth()


@router.get("/ready", response_model=ReadyHealth)
async def ready(
    request: Request,
    response: Response,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_app_settings),
) -> ReadyHealth:
    database_status = "ok"
    try:
        await session.execute(text("SELECT 1"))
    except Exception:
        database_status = "unavailable"
    state = await session.get(IndexerState, 1) if database_status == "ok" else None
    rpc_status = "ok"
    try:
        rpc_chain_id = await asyncio.wait_for(request.app.state.rpc.chain_id(), timeout=5)
        if rpc_chain_id != settings.chain_id:
            rpc_status = "wrong_chain"
    except Exception:
        rpc_status = "unavailable"
    stale = True
    if state and state.last_success_at:
        value = (
            state.last_success_at
            if state.last_success_at.tzinfo
            else state.last_success_at.replace(tzinfo=UTC)
        )
        stale = (datetime.now(UTC) - value).total_seconds() > settings.indexer_stale_after_seconds
    lag = None
    if state and state.safe_head is not None and state.last_finalized_block is not None:
        lag = max(state.safe_head - state.last_finalized_block, 0)
    status = (
        "ok"
        if database_status == "ok"
        and rpc_status == "ok"
        and state
        and state.status == "healthy"
        and not stale
        else "degraded"
    )
    if status != "ok":
        response.status_code = 503
    return ReadyHealth(
        status=status,
        database=database_status,
        rpc=rpc_status,
        indexer=state.status if state else "not_started",
        chain_id=settings.chain_id,
        contract_address=settings.crowdfunding_contract_address,
        last_finalized_block=state.last_finalized_block if state else None,
        safe_head=state.safe_head if state else None,
        observed_head=state.observed_head if state else None,
        lag_blocks=lag,
        stale=stale,
        last_success_at=state.last_success_at if state else None,
        last_error=state.last_error if state else None,
    )
