import asyncio
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status


class SlidingWindowRateLimiter:
    """Thread/async-safe in-memory sliding-window rate limiter per client IP."""

    def __init__(self, max_requests: int, window_seconds: int, prefix: str):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self.prefix = prefix
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def __call__(self, request: Request) -> None:
        forwarded = request.headers.get("x-forwarded-for")
        client_ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
        key = f"{self.prefix}:{client_ip}"
        now = time.monotonic()
        cutoff = now - self.window_seconds

        async with self._lock:
            bucket = self._hits[key]
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()
            if len(bucket) >= self.max_requests:
                retry_after = max(1, int(bucket[0] + self.window_seconds - now) + 1)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many requests. Please wait a moment and try again.",
                    headers={"Retry-After": str(retry_after)},
                )
            bucket.append(now)


login_rate_limiter = SlidingWindowRateLimiter(max_requests=15, window_seconds=60, prefix="admin_login")
access_code_rate_limiter = SlidingWindowRateLimiter(max_requests=30, window_seconds=60, prefix="event_access")
upload_rate_limiter = SlidingWindowRateLimiter(max_requests=60, window_seconds=60, prefix="photo_upload")

