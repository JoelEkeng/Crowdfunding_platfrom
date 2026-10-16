from dataclasses import replace
from datetime import UTC, datetime, timedelta
from typing import Any

from fundchain.indexer.types import BlockData, DecodedEvent

CREATOR = "0x2222222222222222222222222222222222222222"
SUPPORTER = "0x3333333333333333333333333333333333333333"
TOKEN = "0x4444444444444444444444444444444444444444"


def block(number: int, branch: str = "a") -> BlockData:
    parent = f"0x{number - 1:062x}{branch.encode().hex()}" if number > 0 else "0x" + "00" * 32
    return BlockData(
        number=number,
        hash=f"0x{number:062x}{branch.encode().hex()}",
        parent_hash=parent,
        timestamp=datetime(2026, 1, 1, tzinfo=UTC) + timedelta(seconds=number * 12),
    )


def event(
    event_type: str,
    block_number: int,
    *,
    amount: int | None = None,
    campaign_id: int = 1,
    log_index: int = 0,
    branch: str = "a",
) -> DecodedEvent:
    payload: dict[str, Any] = {"campaignId": str(campaign_id)}
    actor = None
    tier_id = None
    if event_type == "CampaignCreated":
        actor = CREATOR
        payload.update(
            creator=CREATOR,
            token=TOKEN,
            goal="100",
            deadline=str(2_000_000_000),
            title="Open wallet",
            description="Transparent wallet infrastructure",
            imageURI="ipfs://image",
        )
    elif event_type == "RewardTierCreated":
        tier_id = 1
        payload.update(tierId="1", minimumContribution="10", perk="Credit")
    elif event_type == "Pledged":
        actor = SUPPORTER
        tier_id = 0
        payload.update(supporter=SUPPORTER, amount=str(amount or 0), tierId="0")
    elif event_type == "FundsClaimed":
        actor = CREATOR
        payload.update(creator=CREATOR, amount=str(amount or 0))
    elif event_type == "Refunded":
        actor = SUPPORTER
        payload.update(supporter=SUPPORTER, amount=str(amount or 0))
    return DecodedEvent(
        event_type=event_type,
        campaign_id=campaign_id,
        actor=actor,
        amount=amount,
        tier_id=tier_id,
        transaction_hash=f"0x{block_number:060x}{log_index:04x}",
        transaction_index=0,
        log_index=log_index,
        block_number=block_number,
        block_hash=block(block_number, branch).hash,
        payload=payload,
    )


class FakeRPC:
    def __init__(
        self, head: int, events: list[DecodedEvent], confirmation_chain: str = "a"
    ) -> None:
        self.head = head
        self.events = events
        self.branch_by_block = {number: confirmation_chain for number in range(head + 1)}
        self.fail = False
        self.chain = 31337

    async def chain_id(self) -> int:
        if self.fail:
            raise TimeoutError("RPC unavailable")
        return self.chain

    async def block_number(self) -> int:
        if self.fail:
            raise TimeoutError("RPC unavailable")
        return self.head

    async def get_block(self, block_number: int) -> BlockData:
        if self.fail:
            raise TimeoutError("RPC unavailable")
        current = block(block_number, self.branch_by_block.get(block_number, "a"))
        if block_number == 0:
            return current
        parent = block(block_number - 1, self.branch_by_block.get(block_number - 1, "a"))
        return replace(current, parent_hash=parent.hash)

    async def get_logs(self, from_block: int, to_block: int) -> list[dict[str, Any]]:
        if self.fail:
            raise TimeoutError("RPC unavailable")
        return [
            {"decoded": item} for item in self.events if from_block <= item.block_number <= to_block
        ]


def decode_fake(value: dict[str, Any]) -> DecodedEvent:
    return value["decoded"]
