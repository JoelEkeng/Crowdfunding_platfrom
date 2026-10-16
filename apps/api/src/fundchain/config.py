from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict
from web3 import Web3


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str
    rpc_url: str
    chain_id: int = Field(gt=0)
    crowdfunding_contract_address: str
    indexer_start_block: int = Field(ge=0)
    confirmation_depth: int = Field(default=12, ge=0, le=10_000)
    indexer_block_range: int = Field(default=500, ge=1, le=10_000)
    indexer_poll_seconds: float = Field(default=12, ge=0.1, le=3600)
    indexer_rpc_retries: int = Field(default=4, ge=1, le=20)
    indexer_stale_after_seconds: int = Field(default=120, ge=1)
    max_reorg_depth: int = Field(default=200, ge=1, le=10_000)
    api_host: str = "127.0.0.1"
    api_port: int = Field(default=8000, ge=1, le=65535)
    api_prefix: str = "/api/v1"
    cors_origins: Annotated[list[str], NoDecode] = Field(
        default_factory=lambda: ["http://localhost:3000"]
    )
    rate_limit_requests: int = Field(default=120, ge=1)
    rate_limit_window_seconds: int = Field(default=60, ge=1)
    rate_limit_storage_url: str = "memory://"
    log_level: str = "INFO"

    @field_validator("rpc_url")
    @classmethod
    def validate_rpc_url(cls, value: str) -> str:
        if not value.startswith(("http://", "https://")):
            raise ValueError("must be an HTTP(S) URL")
        return value

    @field_validator("crowdfunding_contract_address")
    @classmethod
    def validate_address(cls, value: str) -> str:
        if not Web3.is_address(value) or int(value, 16) == 0:
            raise ValueError("must be a nonzero Ethereum address")
        return Web3.to_checksum_address(value)

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [origin.strip() for origin in value.split(",") if origin.strip()]
        return value

    @field_validator("api_prefix")
    @classmethod
    def validate_prefix(cls, value: str) -> str:
        if not value.startswith("/"):
            raise ValueError("must start with /")
        return value.rstrip("/")

    @field_validator("rate_limit_storage_url")
    @classmethod
    def validate_rate_limit_store(cls, value: str) -> str:
        if value != "memory://":
            raise ValueError("only memory:// is supported in this phase")
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()
