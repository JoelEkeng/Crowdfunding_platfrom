from datetime import datetime
from decimal import Decimal
from typing import Any, Literal, cast

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql.elements import ColumnElement

from fundchain.api.dependencies import get_app_settings, get_session
from fundchain.api.service import index_metadata, indexed_chain_time
from fundchain.config import Settings
from fundchain.models import Campaign, CampaignEvent
from fundchain.schemas import (
    CampaignDetailResponse,
    CampaignListResponse,
    CampaignResponse,
    CampaignStatus,
    EventListResponse,
    EventResponse,
    campaign_status,
)

router = APIRouter(prefix="/campaigns", tags=["campaigns"])


def status_condition(status: CampaignStatus, now: datetime) -> ColumnElement[bool]:
    if status == CampaignStatus.ACTIVE:
        return Campaign.deadline > now
    if status == CampaignStatus.SUCCESSFUL:
        return and_(Campaign.deadline <= now, Campaign.total_pledged >= Campaign.goal)
    if status == CampaignStatus.FAILED:
        return and_(Campaign.deadline <= now, Campaign.total_pledged < Campaign.goal)
    return Campaign.deadline <= now


def to_campaign(campaign: Campaign, as_of: datetime) -> CampaignResponse:
    return CampaignResponse.model_validate(
        {
            **{
                column.name: getattr(campaign, column.name) for column in Campaign.__table__.columns
            },
            "status": campaign_status(
                campaign.deadline, campaign.total_pledged, campaign.goal, as_of
            ),
        }
    )


@router.get("", response_model=CampaignListResponse)
async def list_campaigns(
    page: int = Query(1, ge=1, le=1_000_000),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = Query(None, min_length=1, max_length=200),
    status: CampaignStatus | None = None,
    sort: Literal["recent", "funded", "deadline"] = "recent",
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_app_settings),
) -> CampaignListResponse:
    as_of = await indexed_chain_time(session)
    filters = []
    if search:
        escaped = search.replace("%", "\\%").replace("_", "\\_")
        pattern = f"%{escaped}%"
        filters.append(
            or_(
                Campaign.title.ilike(pattern, escape="\\"),
                Campaign.description.ilike(pattern, escape="\\"),
            )
        )
    if status:
        filters.append(status_condition(status, as_of))
    total = await session.scalar(select(func.count()).select_from(Campaign).where(*filters))
    order = cast(
        tuple[ColumnElement[Any], ColumnElement[Any]],
        {
            "recent": (Campaign.created_block.desc(), Campaign.campaign_id.desc()),
            "funded": (Campaign.total_pledged.desc(), Campaign.created_block.desc()),
            "deadline": (Campaign.deadline.asc(), Campaign.created_block.desc()),
        }[sort],
    )
    result = await session.scalars(
        select(Campaign)
        .where(*filters)
        .order_by(*order)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return CampaignListResponse(
        items=[to_campaign(item, as_of) for item in result],
        page=page,
        page_size=page_size,
        total=total or 0,
        index=await index_metadata(session, settings),
    )


@router.get("/{campaign_id}", response_model=CampaignDetailResponse)
async def campaign_detail(
    campaign_id: int,
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_app_settings),
) -> CampaignDetailResponse:
    if campaign_id < 1:
        raise HTTPException(422, "campaign_id must be positive")
    campaign = await session.scalar(
        select(Campaign)
        .options(selectinload(Campaign.tiers))
        .where(Campaign.campaign_id == Decimal(campaign_id))
    )
    if not campaign:
        raise HTTPException(404, "Campaign not found in finalized index")
    base = to_campaign(campaign, await indexed_chain_time(session))
    return CampaignDetailResponse(
        **base.model_dump(),
        tiers=campaign.tiers,
        index=await index_metadata(session, settings),
    )


@router.get("/{campaign_id}/activity", response_model=EventListResponse)
async def campaign_activity(
    campaign_id: int,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_app_settings),
) -> EventListResponse:
    condition = CampaignEvent.campaign_id == Decimal(campaign_id)
    total = await session.scalar(select(func.count()).select_from(CampaignEvent).where(condition))
    events = await session.scalars(
        select(CampaignEvent)
        .where(condition)
        .order_by(CampaignEvent.block_number.desc(), CampaignEvent.log_index.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return EventListResponse(
        items=[EventResponse.model_validate(event) for event in events],
        page=page,
        page_size=page_size,
        total=total or 0,
        index=await index_metadata(session, settings),
    )
