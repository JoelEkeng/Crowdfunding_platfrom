import pytest
from pydantic import ValidationError

from fundchain.config import Settings


def test_required_configuration_fails_clearly() -> None:
    with pytest.raises(ValidationError):
        Settings()  # type: ignore[call-arg]


def test_rejects_zero_contract_address() -> None:
    with pytest.raises(ValidationError, match="nonzero Ethereum address"):
        Settings(
            database_url="postgresql+asyncpg://localhost/fundchain",
            rpc_url="http://localhost:8545",
            chain_id=1,
            crowdfunding_contract_address="0x0000000000000000000000000000000000000000",
            indexer_start_block=0,
        )
