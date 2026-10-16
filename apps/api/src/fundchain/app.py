from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncEngine, AsyncSession, async_sessionmaker

from fundchain.api.router import router
from fundchain.config import Settings
from fundchain.database import create_engine, create_session_factory
from fundchain.indexer.rpc import Web3RPCClient
from fundchain.logging import configure_logging
from fundchain.rate_limit import InMemoryRateLimitMiddleware


def create_app(
    settings: Settings,
    *,
    engine: AsyncEngine | None = None,
    session_factory: async_sessionmaker[AsyncSession] | None = None,
    rpc: object | None = None,
) -> FastAPI:
    configure_logging(settings.log_level)
    app_engine = engine or create_engine(settings.database_url)
    factory = session_factory or create_session_factory(app_engine)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        yield
        if engine is None:
            await app_engine.dispose()

    app = FastAPI(
        title="FundChain Index API",
        version="0.1.0",
        description=(
            "Public discovery API backed by finalized indexed events. "
            "The FundChain contract remains authoritative for financial eligibility."
        ),
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )
    app.state.settings = settings
    app.state.engine = app_engine
    app.state.session_factory = factory
    app.state.rpc = rpc or Web3RPCClient(settings.rpc_url, settings.crowdfunding_contract_address)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=False,
        allow_methods=["GET"],
        allow_headers=["Accept", "Content-Type"],
    )
    if settings.rate_limit_storage_url == "memory://":
        app.add_middleware(
            InMemoryRateLimitMiddleware,
            requests=settings.rate_limit_requests,
            window_seconds=settings.rate_limit_window_seconds,
        )
    app.include_router(router, prefix=settings.api_prefix)

    @app.get("/", include_in_schema=False)
    async def root() -> dict[str, str]:
        return {"service": "fundchain-api", "docs": "/docs"}

    return app
