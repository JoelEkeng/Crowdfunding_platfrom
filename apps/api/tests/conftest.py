from collections.abc import AsyncIterator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from fundchain.app import create_app
from fundchain.config import Settings
from fundchain.models import Base


class HealthyRPC:
    async def chain_id(self) -> int:
        return 31337


@pytest.fixture
def settings() -> Settings:
    return Settings(
        database_url="sqlite+aiosqlite://",
        rpc_url="http://127.0.0.1:8545",
        chain_id=31337,
        crowdfunding_contract_address="0x1111111111111111111111111111111111111111",
        indexer_start_block=1,
        confirmation_depth=2,
        indexer_block_range=10,
        indexer_rpc_retries=2,
        indexer_stale_after_seconds=60,
        max_reorg_depth=20,
        cors_origins=["http://localhost:3000"],
        rate_limit_requests=100,
        rate_limit_window_seconds=60,
    )


@pytest.fixture
async def session_factory() -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    engine = create_async_engine(
        "sqlite+aiosqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    yield factory
    await engine.dispose()


@pytest.fixture
async def client(
    settings: Settings, session_factory: async_sessionmaker[AsyncSession]
) -> AsyncIterator[AsyncClient]:
    app = create_app(settings, session_factory=session_factory, rpc=HealthyRPC())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as value:
        yield value
