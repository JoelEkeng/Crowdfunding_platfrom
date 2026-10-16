import argparse
import asyncio

from fundchain.config import get_settings
from fundchain.database import create_engine, create_session_factory
from fundchain.indexer.service import build_indexer, run_forever
from fundchain.logging import configure_logging


async def run(resync_from: int | None) -> None:
    settings = get_settings()
    configure_logging(settings.log_level)
    engine = create_engine(settings.database_url)
    factory = create_session_factory(engine)
    indexer = build_indexer(settings, factory)
    try:
        if resync_from is not None:
            await indexer.resync_from(resync_from)
        await run_forever(indexer, settings.indexer_poll_seconds)
    finally:
        await engine.dispose()


def main() -> None:
    parser = argparse.ArgumentParser(description="FundChain confirmed-event indexer")
    parser.add_argument(
        "--resync-from",
        type=int,
        help="Delete indexed data from this block and deterministically rebuild projections",
    )
    args = parser.parse_args()
    asyncio.run(run(args.resync_from))


if __name__ == "__main__":
    main()
