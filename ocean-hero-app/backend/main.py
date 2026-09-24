import asyncio
import os
import queue
import threading
import time
from collections import deque

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import json
from fastapi import HTTPException
from live_predict import (
    predict_live_streaming, get_ocean_state, get_ocean_state_streaming,
    get_argo_dates_with_data, get_argo_floats_by_date, get_argo_profile_coverage, get_recent_argo_count,
    get_argo_float_track, get_argo_float_suggestions,
    argo_date_comparison_streaming, get_argo_date_comparison,
)

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"], expose_headers=["Retry-After"])


@app.get("/api/health")
def health():
    # No Copernicus/Argo fetch, no model call - just proves the process is up.
    return {"status": "ok"}

# ---- Per-IP rate limit for the slow, real-cost live endpoints -------------
# Each live call triggers real Copernicus fetches (5-90+ s), so the three
# live routes below allow a small number of requests per IP per minute. This
# is deliberately simple (in-memory sliding window, one process): it guards
# against accidental or deliberate hammering, it is not authentication.
# Only the live routes are limited; health and the Argo lookups are not.
RATE_LIMIT_PER_MINUTE = int(os.environ.get("LIVE_RATE_LIMIT_PER_MIN", "5"))
_RATE_WINDOW_SECONDS = 60
# The client IP is the direct TCP peer by default. Behind a reverse proxy
# (e.g. Azure App Service) that is the proxy's address for everyone, so set
# TRUST_FORWARDED_FOR=1 there to use the first X-Forwarded-For entry instead.
# Off by default because that header is trivially spoofable when no trusted
# proxy sets it.
_TRUST_FORWARDED_FOR = os.environ.get("TRUST_FORWARDED_FOR") == "1"
_rate_hits: "dict[str, deque]" = {}
_rate_lock = threading.Lock()


def _strip_port(addr: str) -> str:
    # Azure's proxy sends the client as "IP:port" in X-Forwarded-For, and the
    # port changes with every new connection - keyed on it, each connection got
    # its own fresh rate-limit bucket. Keep only the address. Handles
    # "1.2.3.4:5678", "[::1]:5678", and leaves a bare IPv6 address alone.
    addr = addr.strip()
    if addr.startswith("["):
        end = addr.find("]")
        return addr[1:end] if end != -1 else addr
    if addr.count(":") == 1:
        return addr.split(":", 1)[0]
    return addr


def _client_ip(request: Request) -> str:
    if _TRUST_FORWARDED_FOR:
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            return _strip_port(fwd.split(",")[0])
    return request.client.host if request.client else "unknown"


def _enforce_rate_limit(request: Request):
    ip = _client_ip(request)
    now = time.monotonic()
    with _rate_lock:
        # Drop idle IPs so the table can't grow without bound.
        for k in [k for k, d in _rate_hits.items() if d and now - d[-1] > _RATE_WINDOW_SECONDS]:
            del _rate_hits[k]
        hits = _rate_hits.setdefault(ip, deque())
        while hits and now - hits[0] > _RATE_WINDOW_SECONDS:
            hits.popleft()
        if len(hits) >= RATE_LIMIT_PER_MINUTE:
            retry_after = max(1, int(_RATE_WINDOW_SECONDS - (now - hits[0])) + 1)
            raise HTTPException(
                status_code=429,
                detail=f"Rate limit exceeded: at most {RATE_LIMIT_PER_MINUTE} live requests per minute per IP. Try again in {retry_after} s.",
                headers={"Retry-After": str(retry_after)},
            )
        hits.append(now)


# Some real fetch steps (esp. hunting back day-by-day through Copernicus
# Marine for the most recent valid grid) can legitimately take minutes with
# no new step to report. Azure App Service's front door silently drops any
# connection that goes ~230s without a byte of traffic, which killed those
# requests before they ever reached "done" - not a code bug, just an idle
# proxy timeout. To keep the connection alive without touching any of the
# real fetch/prediction logic, we run the existing generator in a
# background thread and interleave real updates with harmless SSE comment
# pings (lines starting with ":", ignored by EventSource) whenever the next
# real update is taking a while.
_HEARTBEAT_SECONDS = 15


async def _sse_with_heartbeat(sync_generator_fn):
    q: "queue.Queue" = queue.Queue()
    _SENTINEL = object()

    def worker():
        try:
            for update in sync_generator_fn():
                q.put(update)
        except Exception as e:
            q.put({"step": "error", "done": True, "error": str(e)})
        finally:
            q.put(_SENTINEL)

    threading.Thread(target=worker, daemon=True).start()

    loop = asyncio.get_event_loop()
    while True:
        try:
            item = await loop.run_in_executor(None, q.get, True, _HEARTBEAT_SECONDS)
        except queue.Empty:
            yield ": keep-alive\n\n"
            continue

        if item is _SENTINEL:
            return
        try:
            payload = json.dumps(item, allow_nan=False)
        except ValueError:
            # A NaN/Infinity slipped through: json would emit the literal NaN,
            # which is not valid JSON and makes the browser's JSON.parse throw.
            # Report it honestly instead of sending a broken or fake value.
            item = {"step": "error", "done": True, "error": "Live data contained an invalid value and was discarded."}
            payload = json.dumps(item)
        yield f"data: {payload}\n\n"
        if item.get("done"):
            return


@app.get("/api/live-predict/stream")
async def live_predict_stream(lat: float, lon: float, request: Request):
    _enforce_rate_limit(request)
    return StreamingResponse(
        _sse_with_heartbeat(lambda: predict_live_streaming(lat, lon)),
        media_type="text/event-stream",
    )


@app.get("/api/ocean-state/stream")
async def ocean_state_stream(lat: float, lon: float, request: Request):
    _enforce_rate_limit(request)
    # Same SSE pattern as /api/live-predict/stream above, so the
    # Intelligence page can show the same kind of real, honest step-by-step
    # progress checklist the Solution page's live mode already shows,
    # instead of a single static "loading" label.
    return StreamingResponse(
        _sse_with_heartbeat(lambda: get_ocean_state_streaming(lat, lon)),
        media_type="text/event-stream",
    )


@app.get("/api/ocean-state")
def ocean_state(lat: float, lon: float, request: Request):
    _enforce_rate_limit(request)
    # Plain `def`, not `async def` — get_ocean_state() is a long chain of
    # blocking synchronous calls (copernicusmarine, xarray, torch). An
    # `async def` route calling that directly blocks FastAPI's single event
    # loop for the whole app (every page, every concurrent tab) until it
    # returns. A plain `def` route is instead run by Starlette in its worker
    # threadpool automatically, exactly like /api/live-predict/stream's sync
    # generator already does via iterate_in_threadpool — so this endpoint
    # now behaves the same way that one reliably does.
    #
    # get_ocean_state() never raises — every field it can't real-fetch or
    # compute is left as an honest null instead, so this real 5-90s live
    # lookup always returns a normal 200 with the full response shape, even
    # for a point outside all real model coverage (subsurface.valid: false).
    return get_ocean_state(lat, lon)


# ---- Recent Validation Calendar (Solution page) -------------------------
# Plain `def` routes (run in Starlette's threadpool) because the real Argo
# index lookups and the comparison's real fetches are blocking calls.

def _bad_request(e: ValueError):
    raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/argo-dates-with-data")
def argo_dates_with_data(region: str, start_date: str, end_date: str):
    try:
        return get_argo_dates_with_data(region, start_date, end_date)
    except ValueError as e:
        _bad_request(e)


@app.get("/api/argo-floats-by-date")
def argo_floats_by_date(date: str, region: str):
    try:
        return get_argo_floats_by_date(date, region)
    except ValueError as e:
        _bad_request(e)


@app.get("/api/argo-profile-coverage")
def argo_profile_coverage(date: str, region: str):
    try:
        return get_argo_profile_coverage(date, region)
    except ValueError as e:
        _bad_request(e)


@app.get("/api/argo-float-track")
def argo_float_track(float_id: str, months: int = 12):
    try:
        return get_argo_float_track(float_id, months)
    except ValueError as e:
        _bad_request(e)


@app.get("/api/argo-float-suggestions")
def argo_float_suggestions(region: str = "both"):
    try:
        return get_argo_float_suggestions(region)
    except ValueError as e:
        _bad_request(e)


@app.get("/api/recent-argo-count")
def recent_argo_count(region: str):
    try:
        return get_recent_argo_count(region)
    except ValueError as e:
        _bad_request(e)


@app.get("/api/argo-date-comparison")
def argo_date_comparison(lat: float, lon: float, date: str):
    return get_argo_date_comparison(lat, lon, date)


@app.get("/api/argo-date-comparison/stream")
async def argo_date_comparison_stream(lat: float, lon: float, date: str):
    # Same SSE + heartbeat pattern as the other live endpoints, so the UI can
    # show real step-by-step progress for this multi-fetch comparison.
    return StreamingResponse(
        _sse_with_heartbeat(lambda: argo_date_comparison_streaming(lat, lon, date)),
        media_type="text/event-stream",
    )
