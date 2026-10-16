from datetime import UTC, datetime
from typing import Any, cast

from eth_typing import HexStr
from web3 import AsyncHTTPProvider, AsyncWeb3, Web3
from web3._utils.events import get_event_data

from fundchain.abi import CROWDFUNDING_EVENTS_ABI
from fundchain.indexer.types import BlockData, DecodedEvent


class Web3RPCClient:
    def __init__(self, rpc_url: str, contract_address: str) -> None:
        self.web3 = AsyncWeb3(AsyncHTTPProvider(rpc_url, request_kwargs={"timeout": 30}))
        self.contract_address = Web3.to_checksum_address(contract_address)
        self.event_abis = {item["name"]: item for item in CROWDFUNDING_EVENTS_ABI}
        self.topics = {}
        for item in CROWDFUNDING_EVENTS_ABI:
            types = ",".join(input_abi["type"] for input_abi in item["inputs"])
            signature = f"{item['name']}({types})"
            self.topics[Web3.keccak(text=signature).to_0x_hex()] = item

    async def chain_id(self) -> int:
        return await self.web3.eth.chain_id

    async def block_number(self) -> int:
        return await self.web3.eth.block_number

    async def get_block(self, block_number: int) -> BlockData:
        block = await self.web3.eth.get_block(block_number)
        return BlockData(
            number=block["number"],
            hash=block["hash"].to_0x_hex(),
            parent_hash=block["parentHash"].to_0x_hex(),
            timestamp=datetime.fromtimestamp(block["timestamp"], UTC),
        )

    async def get_logs(self, from_block: int, to_block: int) -> list[dict[str, Any]]:
        topic_values = cast(list[HexStr], list(self.topics.keys()))
        logs = await self.web3.eth.get_logs(
            {
                "address": self.contract_address,
                "fromBlock": from_block,
                "toBlock": to_block,
                "topics": [topic_values],
            }
        )
        return cast(list[dict[str, Any]], logs)

    def decode_log(self, log: dict[str, Any]) -> DecodedEvent:
        topic = log["topics"][0].to_0x_hex()
        abi = self.topics[topic]
        decoded = get_event_data(self.web3.codec, abi, log)
        args = dict(decoded["args"])
        event_type = decoded["event"]
        actor = args.get("creator") or args.get("supporter")
        payload = {
            key: str(value) if isinstance(value, int) else value for key, value in args.items()
        }
        return DecodedEvent(
            event_type=event_type,
            campaign_id=int(args["campaignId"]),
            actor=Web3.to_checksum_address(actor) if actor else None,
            amount=int(args["amount"]) if "amount" in args else None,
            tier_id=int(args["tierId"]) if "tierId" in args else None,
            transaction_hash=log["transactionHash"].to_0x_hex(),
            transaction_index=int(log["transactionIndex"]),
            log_index=int(log["logIndex"]),
            block_number=int(log["blockNumber"]),
            block_hash=log["blockHash"].to_0x_hex(),
            payload=payload,
        )
