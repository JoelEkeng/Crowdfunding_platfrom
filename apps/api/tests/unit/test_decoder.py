from eth_abi import encode
from hexbytes import HexBytes
from web3 import Web3

from fundchain.indexer.rpc import Web3RPCClient
from tests.helpers import SUPPORTER


def topic_uint(value: int) -> HexBytes:
    return HexBytes(value.to_bytes(32, "big"))


def topic_address(address: str) -> HexBytes:
    return HexBytes(bytes.fromhex(address[2:]).rjust(32, b"\0"))


def test_decodes_actual_pledged_event_signature() -> None:
    rpc = Web3RPCClient("http://127.0.0.1:8545", "0x1111111111111111111111111111111111111111")
    signature = Web3.keccak(text="Pledged(uint256,address,uint256,uint256)")
    log = {
        "address": rpc.contract_address,
        "topics": [signature, topic_uint(9), topic_address(SUPPORTER), topic_uint(2)],
        "data": HexBytes(encode(["uint256"], [123456789])),
        "blockNumber": 10,
        "transactionHash": HexBytes("0x" + "ab" * 32),
        "transactionIndex": 1,
        "blockHash": HexBytes("0x" + "cd" * 32),
        "logIndex": 3,
        "removed": False,
    }
    decoded = rpc.decode_log(log)
    assert decoded.event_type == "Pledged"
    assert decoded.campaign_id == 9
    assert decoded.actor == Web3.to_checksum_address(SUPPORTER)
    assert decoded.amount == 123456789
    assert decoded.tier_id == 2
