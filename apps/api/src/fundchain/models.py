from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

UINT256 = Numeric(78, 0)


class Base(DeclarativeBase):
    pass


class IndexedBlock(Base):
    __tablename__ = "indexed_blocks"
    chain_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    block_number: Mapped[int] = mapped_column(BigInteger, primary_key=True)
    block_hash: Mapped[str] = mapped_column(String(66), nullable=False)
    parent_hash: Mapped[str] = mapped_column(String(66), nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    __table_args__ = (UniqueConstraint("chain_id", "block_hash"),)


class Campaign(Base):
    __tablename__ = "campaigns"
    campaign_id: Mapped[Decimal] = mapped_column(UINT256, primary_key=True, autoincrement=False)
    creator: Mapped[str] = mapped_column(String(42), nullable=False, index=True)
    token: Mapped[str] = mapped_column(String(42), nullable=False, index=True)
    goal: Mapped[Decimal] = mapped_column(UINT256, nullable=False)
    deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, index=True)
    title: Mapped[str] = mapped_column(String(400), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    image_uri: Mapped[str] = mapped_column(String(2000), nullable=False)
    total_pledged: Mapped[Decimal] = mapped_column(UINT256, nullable=False, default=0)
    total_refunded: Mapped[Decimal] = mapped_column(UINT256, nullable=False, default=0)
    funds_claimed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_block: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    created_tx_hash: Mapped[str] = mapped_column(String(66), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    tiers: Mapped[list["RewardTier"]] = relationship(cascade="all, delete-orphan")
    __table_args__ = (
        Index("ix_campaign_search", "title", "description"),
        Index("ix_campaign_deadline_pledged", "deadline", "total_pledged"),
    )


class RewardTier(Base):
    __tablename__ = "reward_tiers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    campaign_id: Mapped[Decimal] = mapped_column(
        UINT256, ForeignKey("campaigns.campaign_id", ondelete="CASCADE"), nullable=False
    )
    tier_id: Mapped[Decimal] = mapped_column(UINT256, nullable=False)
    minimum_contribution: Mapped[Decimal] = mapped_column(UINT256, nullable=False)
    perk: Mapped[str] = mapped_column(Text, nullable=False)
    __table_args__ = (UniqueConstraint("campaign_id", "tier_id"),)


class SupporterPledge(Base):
    __tablename__ = "supporter_pledges"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    campaign_id: Mapped[Decimal] = mapped_column(
        UINT256, ForeignKey("campaigns.campaign_id", ondelete="CASCADE"), nullable=False
    )
    supporter: Mapped[str] = mapped_column(String(42), nullable=False)
    gross_pledged: Mapped[Decimal] = mapped_column(UINT256, nullable=False, default=0)
    refunded: Mapped[Decimal] = mapped_column(UINT256, nullable=False, default=0)
    updated_block: Mapped[int] = mapped_column(BigInteger, nullable=False)
    __table_args__ = (
        UniqueConstraint("campaign_id", "supporter"),
        Index("ix_supporter_pledges_supporter_campaign", "supporter", "campaign_id"),
    )


class CampaignEvent(Base):
    __tablename__ = "campaign_events"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chain_id: Mapped[int] = mapped_column(Integer, nullable=False)
    contract_address: Mapped[str] = mapped_column(String(42), nullable=False)
    transaction_hash: Mapped[str] = mapped_column(String(66), nullable=False)
    log_index: Mapped[int] = mapped_column(Integer, nullable=False)
    block_number: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    block_hash: Mapped[str] = mapped_column(String(66), nullable=False)
    transaction_index: Mapped[int] = mapped_column(Integer, nullable=False)
    event_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    campaign_id: Mapped[Decimal] = mapped_column(UINT256, nullable=False, index=True)
    actor: Mapped[str | None] = mapped_column(String(42), nullable=True, index=True)
    amount: Mapped[Decimal | None] = mapped_column(UINT256, nullable=True)
    tier_id: Mapped[Decimal | None] = mapped_column(UINT256, nullable=True)
    payload: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    block_timestamp: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    __table_args__ = (
        UniqueConstraint(
            "chain_id",
            "contract_address",
            "transaction_hash",
            "log_index",
            name="uq_event_chain_contract_tx_log",
        ),
        Index("ix_events_campaign_block_log", "campaign_id", "block_number", "log_index"),
        Index("ix_events_actor_block", "actor", "block_number"),
    )


class IndexerState(Base):
    __tablename__ = "indexer_state"
    id: Mapped[int] = mapped_column(Integer, primary_key=True, default=1)
    chain_id: Mapped[int] = mapped_column(Integer, nullable=False)
    contract_address: Mapped[str] = mapped_column(String(42), nullable=False)
    last_finalized_block: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    last_finalized_hash: Mapped[str | None] = mapped_column(String(66), nullable=True)
    observed_head: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    safe_head: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="starting")
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now()
    )
