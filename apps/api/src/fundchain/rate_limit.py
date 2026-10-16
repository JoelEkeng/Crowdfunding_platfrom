import asyncio
import time
from collections import defaultdict, deque

from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send


class InMemoryRateLimitMiddleware:
    def __init__(self, app: ASGIApp, requests: int, window_seconds: int) -> None:
        self.app = app
        self.requests = requests
        self.window_seconds = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http" or scope.get("path", "").endswith(
            ("/health/live", "/health/ready")
        ):
            await self.app(scope, receive, send)
            return
        client = scope.get("client")
        key = f"{client[0] if client else 'unknown'}:{scope.get('path', '')}"
        now = time.monotonic()
        async with self._lock:
            hits = self._hits[key]
            while hits and hits[0] <= now - self.window_seconds:
                hits.popleft()
            if len(hits) >= self.requests:
                response = JSONResponse(
                    {"detail": "Rate limit exceeded"},
                    status_code=429,
                    headers={"Retry-After": str(self.window_seconds)},
                )
                await response(scope, receive, send)
                return
            hits.append(now)
        await self.app(scope, receive, send)
