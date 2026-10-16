from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from web3 import Web3

from fundchain.api.dependencies import get_app_settings, get_session
from fundchain.api.routes.campaigns import to_campaign
from fundchain.api.service import index_metadata, indexed_chain_time
from fundchain.config import Settings
from fundchain.models import Campaign, CampaignEvent, SupporterPledge
from fundchain.schemas import EventResponse, UserActivityResponse, UserCampaignActivity

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/{address}/activity", response_model=UserActivityResponse)
async def user_activity(
    address: str,
    event_limit: int = Query(100, ge=1, le=200),
    session: AsyncSession = Depends(get_session),
    settings: Settings = Depends(get_app_settings),
) -> UserActivityResponse:
    if not Web3.is_address(address):
        raise HTTPException(422, "Invalid Ethereum address")
    normalized = Web3.to_checksum_address(address)
    created = list(
        await session.scalars(
            select(Campaign)
            .where(Campaign.creator == normalized)
            .order_by(Campaign.created_block.desc())
            .limit(100)
        )
    )
    contribution_rows = (
        await session.execute(
            select(SupporterPledge, Campaign)
            .join(Campaign, Campaign.campaign_id == SupporterPledge.campaign_id)
            .where(SupporterPledge.supporter == normalized)
            .order_by(SupporterPledge.updated_block.desc())
            .limit(100)
        )
    ).all()
    events = list(
        await session.scalars(
            select(CampaignEvent)
            .where(CampaignEvent.actor == normalized)
            .order_by(CampaignEvent.block_number.desc(), CampaignEvent.log_index.desc())
            .limit(event_limit)
        )
    )
    as_of = await indexed_chain_time(session)
    return UserActivityResponse(
        address=normalized,
        created=[to_campaign(campaign, as_of) for campaign in created],
        contributed=[
            UserCampaignActivity(
                campaign=to_campaign(campaign, as_of),
                gross_pledged=pledge.gross_pledged,
                refunded=pledge.refunded,
            )
            for pledge, campaign in contribution_rows
        ],
        events=[EventResponse.model_validate(event) for event in events],
        index=await index_metadata(session, settings),
    )
