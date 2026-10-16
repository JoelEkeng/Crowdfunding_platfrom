import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker

from fundchain.app import create_app
from fundchain.config import Settings


class RPC:
    async def chain_id(self) -> int:
        return 31337


@pytest.mark.asyncio
async def test_rate_limit_is_enforced_but_liveness_is_exempt(
    settings: Settings, session_factory: async_sessionmaker[AsyncSession]
) -> None:
    limited = settings.model_copy(update={"rate_limit_requests": 1})
    app = create_app(limited, session_factory=session_factory, rpc=RPC())
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.get("/")).status_code == 200
        response = await client.get("/")
        assert response.status_code == 429
        assert response.headers["retry-after"] == "60"
        assert (await client.get("/api/v1/health/live")).status_code == 200
