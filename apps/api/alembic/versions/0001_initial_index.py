"""Initial finalized event index.

Revision ID: 0001
"""

import sqlalchemy as sa

from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None
uint256 = sa.Numeric(78, 0)


def upgrade() -> None:
    op.create_table(
        "indexed_blocks",
        sa.Column("chain_id", sa.Integer(), nullable=False),
        sa.Column("block_number", sa.BigInteger(), nullable=False),
        sa.Column("block_hash", sa.String(66), nullable=False),
        sa.Column("parent_hash", sa.String(66), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("chain_id", "block_number"),
        sa.UniqueConstraint("chain_id", "block_hash"),
    )
    op.create_table(
        "campaigns",
        sa.Column("campaign_id", uint256, primary_key=True),
        sa.Column("creator", sa.String(42), nullable=False),
        sa.Column("token", sa.String(42), nullable=False),
        sa.Column("goal", uint256, nullable=False),
        sa.Column("deadline", sa.DateTime(timezone=True), nullable=False),
        sa.Column("title", sa.String(400), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("image_uri", sa.String(2000), nullable=False),
        sa.Column("total_pledged", uint256, nullable=False),
        sa.Column("total_refunded", uint256, nullable=False),
        sa.Column("funds_claimed", sa.Boolean(), nullable=False),
        sa.Column("created_block", sa.BigInteger(), nullable=False),
        sa.Column("created_tx_hash", sa.String(66), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_campaigns_creator", "campaigns", ["creator"])
    op.create_index("ix_campaigns_token", "campaigns", ["token"])
    op.create_index("ix_campaigns_deadline", "campaigns", ["deadline"])
    op.create_index("ix_campaigns_created_block", "campaigns", ["created_block"])
    op.create_index("ix_campaign_search", "campaigns", ["title", "description"])
    op.create_index("ix_campaign_deadline_pledged", "campaigns", ["deadline", "total_pledged"])
    op.create_table(
        "reward_tiers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "campaign_id",
            uint256,
            sa.ForeignKey("campaigns.campaign_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("tier_id", uint256, nullable=False),
        sa.Column("minimum_contribution", uint256, nullable=False),
        sa.Column("perk", sa.Text(), nullable=False),
        sa.UniqueConstraint("campaign_id", "tier_id"),
    )
    op.create_table(
        "supporter_pledges",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "campaign_id",
            uint256,
            sa.ForeignKey("campaigns.campaign_id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("supporter", sa.String(42), nullable=False),
        sa.Column("gross_pledged", uint256, nullable=False),
        sa.Column("refunded", uint256, nullable=False),
        sa.Column("updated_block", sa.BigInteger(), nullable=False),
        sa.UniqueConstraint("campaign_id", "supporter"),
    )
    op.create_index(
        "ix_supporter_pledges_supporter_campaign", "supporter_pledges", ["supporter", "campaign_id"]
    )
    op.create_table(
        "campaign_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("chain_id", sa.Integer(), nullable=False),
        sa.Column("contract_address", sa.String(42), nullable=False),
        sa.Column("transaction_hash", sa.String(66), nullable=False),
        sa.Column("log_index", sa.Integer(), nullable=False),
        sa.Column("block_number", sa.BigInteger(), nullable=False),
        sa.Column("block_hash", sa.String(66), nullable=False),
        sa.Column("transaction_index", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(40), nullable=False),
        sa.Column("campaign_id", uint256, nullable=False),
        sa.Column("actor", sa.String(42)),
        sa.Column("amount", uint256),
        sa.Column("tier_id", uint256),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("block_timestamp", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint(
            "chain_id",
            "contract_address",
            "transaction_hash",
            "log_index",
            name="uq_event_chain_contract_tx_log",
        ),
    )
    op.create_index("ix_campaign_events_block_number", "campaign_events", ["block_number"])
    op.create_index("ix_campaign_events_event_type", "campaign_events", ["event_type"])
    op.create_index("ix_campaign_events_campaign_id", "campaign_events", ["campaign_id"])
    op.create_index("ix_campaign_events_actor", "campaign_events", ["actor"])
    op.create_index(
        "ix_events_campaign_block_log",
        "campaign_events",
        ["campaign_id", "block_number", "log_index"],
    )
    op.create_index("ix_events_actor_block", "campaign_events", ["actor", "block_number"])
    op.create_table(
        "indexer_state",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("chain_id", sa.Integer(), nullable=False),
        sa.Column("contract_address", sa.String(42), nullable=False),
        sa.Column("last_finalized_block", sa.BigInteger()),
        sa.Column("last_finalized_hash", sa.String(66)),
        sa.Column("observed_head", sa.BigInteger()),
        sa.Column("safe_head", sa.BigInteger()),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("last_error", sa.Text()),
        sa.Column("last_success_at", sa.DateTime(timezone=True)),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )


def downgrade() -> None:
    op.drop_table("indexer_state")
    op.drop_table("campaign_events")
    op.drop_table("supporter_pledges")
    op.drop_table("reward_tiers")
    op.drop_table("campaigns")
    op.drop_table("indexed_blocks")
