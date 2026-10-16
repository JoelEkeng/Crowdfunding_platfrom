from datetime import UTC, datetime
from decimal import Decimal
from enum import StrEnum

from pydantic import BaseModel, ConfigDict, field_serializer


class CampaignStatus(StrEnum):
    ACTIVE = "active"
    SUCCESSFUL = "successful"
    FAILED = "failed"
    COMPLETED = "completed"


class IndexedMetadata(BaseModel):
    indexed_through_block: int | None
    safe_head: int | None
    observed_head: int | None
    confirmation_depth: int
    stale: bool
    complete: bool
    source: str = "finalized_index"


class RewardTierResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    tier_id: Decimal
    minimum_contribution: Decimal
    perk: str

    @field_serializer("tier_id", "minimum_contribution")
    def serialize_integer(self, value: Decimal) -> str:
        return str(int(value))


class CampaignResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    campaign_id: Decimal
    creator: str
    token: str
    goal: Decimal
    deadline: datetime
    title: str
    description: str
    image_uri: str
    total_pledged: Decimal
    total_refunded: Decimal
    funds_claimed: bool
    created_block: int
    created_tx_hash: str
    created_at: datetime
    status: CampaignStatus

    @field_serializer("campaign_id", "goal", "total_pledged", "total_refunded")
    def serialize_integer(self, value: Decimal) -> str:
        return str(int(value))


class CampaignDetailResponse(CampaignResponse):
    tiers: list[RewardTierResponse]
    index: IndexedMetadata


class CampaignListResponse(BaseModel):
    items: list[CampaignResponse]
    page: int
    page_size: int
    total: int
    index: IndexedMetadata


class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    event_type: str
    campaign_id: Decimal
    actor: str | None
    amount: Decimal | None
    tier_id: Decimal | None
    transaction_hash: str
    transaction_index: int
    log_index: int
    block_number: int
    block_hash: str
    block_timestamp: datetime
    payload: dict[str, object]

    @field_serializer("campaign_id", "amount", "tier_id")
    def serialize_optional_integer(self, value: Decimal | None) -> str | None:
        return None if value is None else str(int(value))


class EventListResponse(BaseModel):
    items: list[EventResponse]
    page: int
    page_size: int
    total: int
    index: IndexedMetadata


class UserCampaignActivity(BaseModel):
    campaign: CampaignResponse
    gross_pledged: Decimal = Decimal(0)
    refunded: Decimal = Decimal(0)

    @field_serializer("gross_pledged", "refunded")
    def serialize_integer(self, value: Decimal) -> str:
        return str(int(value))


class UserActivityResponse(BaseModel):
    address: str
    created: list[CampaignResponse]
    contributed: list[UserCampaignActivity]
    events: list[EventResponse]
    index: IndexedMetadata


class LiveHealth(BaseModel):
    status: str = "ok"


class ReadyHealth(BaseModel):
    status: str
    database: str
    rpc: str
    indexer: str
    chain_id: int
    contract_address: str
    last_finalized_block: int | None
    safe_head: int | None
    observed_head: int | None
    lag_blocks: int | None
    stale: bool
    last_success_at: datetime | None
    last_error: str | None


def campaign_status(
    deadline: datetime, pledged: Decimal, goal: Decimal, now: datetime | None = None
) -> CampaignStatus:
    now = now or datetime.now(UTC)
    normalized_deadline = deadline if deadline.tzinfo else deadline.replace(tzinfo=UTC)
    if normalized_deadline > now:
        return CampaignStatus.ACTIVE
    return CampaignStatus.SUCCESSFUL if pledged >= goal else CampaignStatus.FAILED
