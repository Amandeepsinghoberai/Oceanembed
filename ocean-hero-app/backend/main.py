import asyncio
import queue
import threading

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import json
from live_predict import predict_live_streaming, get_ocean_state, get_ocean_state_streaming

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

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
        yield f"data: {json.dumps(item)}\n\n"
        if item.get("done"):
            return


@app.get("/api/live-predict/stream")
async def live_predict_stream(lat: float, lon: float):
    return StreamingResponse(
        _sse_with_heartbeat(lambda: predict_live_streaming(lat, lon)),
        media_type="text/event-stream",
    )


@app.get("/api/ocean-state/stream")
async def ocean_state_stream(lat: float, lon: float):
    # Same SSE pattern as /api/live-predict/stream above, so the
    # Intelligence page can show the same kind of real, honest step-by-step
    # progress checklist the Solution page's live mode already shows,
    # instead of a single static "loading" label.
    return StreamingResponse(
        _sse_with_heartbeat(lambda: get_ocean_state_streaming(lat, lon)),
        media_type="text/event-stream",
    )


@app.get("/api/ocean-state")
def ocean_state(lat: float, lon: float):
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
