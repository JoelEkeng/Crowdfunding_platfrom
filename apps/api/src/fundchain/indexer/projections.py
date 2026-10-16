from datetime import datetime
from decimal import Decimal

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from fundchain.indexer.types import DecodedEvent
from fundchain.models import Campaign, CampaignEvent, RewardTier, SupporterPledge


def amount(value: int | str | None) -> Decimal:
    return Decimal(value or 0)


async def apply_event(session: AsyncSession, event: DecodedEvent, timestamp: datetime) -> None:
    campaign_id = Decimal(event.campaign_id)
    payload = event.payload
    if event.event_type == "CampaignCreated":
        session.add(
            Campaign(
                campaign_id=campaign_id,
                creator=str(payload["creator"]),
                token=str(payload["token"]),
                goal=amount(payload["goal"]),
                deadline=datetime.fromtimestamp(int(payload["deadline"]), timestamp.tzinfo),
                title=str(payload["title"]),
                description=str(payload["description"]),
                image_uri=str(payload["imageURI"]),
                total_pledged=Decimal(0),
                total_refunded=Decimal(0),
                funds_claimed=False,
                created_block=event.block_number,
                created_tx_hash=event.transaction_hash,
                created_at=timestamp,
            )
        )
        return
    campaign = await session.get(Campaign, campaign_id)
    if not campaign:
        raise RuntimeError(f"event {event.event_type} references unknown campaign {campaign_id}")
    if event.event_type == "RewardTierCreated":
        session.add(
            RewardTier(
                campaign_id=campaign_id,
                tier_id=amount(payload["tierId"]),
                minimum_contribution=amount(payload["minimumContribution"]),
                perk=str(payload["perk"]),
            )
        )
    elif event.event_type == "Pledged":
        value = amount(event.amount)
        campaign.total_pledged += value
        supporter = str(payload["supporter"])
        pledge = await session.scalar(
            select(SupporterPledge).where(
                SupporterPledge.campaign_id == campaign_id,
                SupporterPledge.supporter == supporter,
            )
        )
        if pledge is None:
            pledge = SupporterPledge(
                campaign_id=campaign_id,
                supporter=supporter,
                gross_pledged=Decimal(0),
                refunded=Decimal(0),
                updated_block=event.block_number,
            )
            session.add(pledge)
        pledge.gross_pledged += value
        pledge.updated_block = event.block_number
    elif event.event_type == "FundsClaimed":
        campaign.funds_claimed = True
    elif event.event_type == "Refunded":
        value = amount(event.amount)
        campaign.total_refunded += value
        supporter = str(payload["supporter"])
        pledge = await session.scalar(
            select(SupporterPledge).where(
                SupporterPledge.campaign_id == campaign_id,
                SupporterPledge.supporter == supporter,
            )
        )
        if pledge is None or pledge.gross_pledged - pledge.refunded < value:
            raise RuntimeError("refund exceeds indexed supporter pledge")
        pledge.refunded += value
        pledge.updated_block = event.block_number


async def rebuild_projections(session: AsyncSession) -> None:
    await session.execute(delete(RewardTier))
    await session.execute(delete(SupporterPledge))
    await session.execute(delete(Campaign))
    events = await session.scalars(
        select(CampaignEvent).order_by(
            CampaignEvent.block_number, CampaignEvent.transaction_index, CampaignEvent.log_index
        )
    )
    for stored in events:
        event = DecodedEvent(
            event_type=stored.event_type,
            campaign_id=int(stored.campaign_id),
            actor=stored.actor,
            amount=int(stored.amount) if stored.amount is not None else None,
            tier_id=int(stored.tier_id) if stored.tier_id is not None else None,
            transaction_hash=stored.transaction_hash,
            transaction_index=stored.transaction_index,
            log_index=stored.log_index,
            block_number=stored.block_number,
            block_hash=stored.block_hash,
            payload=stored.payload,
        )
        await apply_event(session, event, stored.block_timestamp)
        await session.flush()
