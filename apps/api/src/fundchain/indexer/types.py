from dataclasses import dataclass
from datetime import datetime
from typing import Any, Protocol


@dataclass(frozen=True)
class BlockData:
    number: int
    hash: str
    parent_hash: str
    timestamp: datetime


@dataclass(frozen=True)
class DecodedEvent:
    event_type: str
    campaign_id: int
    actor: str | None
    amount: int | None
    tier_id: int | None
    transaction_hash: str
    transaction_index: int
    log_index: int
    block_number: int
    block_hash: str
    payload: dict[str, Any]


class RPCClient(Protocol):
    async def chain_id(self) -> int: ...
    async def block_number(self) -> int: ...
    async def get_block(self, block_number: int) -> BlockData: ...
    async def get_logs(self, from_block: int, to_block: int) -> list[dict[str, Any]]: ...
