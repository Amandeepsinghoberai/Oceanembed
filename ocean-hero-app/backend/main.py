from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import json
from live_predict import predict_live_streaming, get_ocean_state, get_ocean_state_streaming

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/live-predict/stream")
async def live_predict_stream(lat: float, lon: float):
    def event_generator():
        try:
            for update in predict_live_streaming(lat, lon):
                yield f"data: {json.dumps(update)}\n\n"
        except Exception as e:
            # A real fetch/predict step failed (network issue, Copernicus down,
            # missing/expired login, point outside the trained region, etc).
            # Surface it as an explicit SSE error event so the frontend shows a
            # clear failure state instead of the connection just going silent.
            yield f"data: {json.dumps({'step': 'error', 'done': True, 'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/api/ocean-state/stream")
async def ocean_state_stream(lat: float, lon: float):
    # Same SSE pattern as /api/live-predict/stream above, so the
    # Intelligence page can show the same kind of real, honest step-by-step
    # progress checklist the Solution page's live mode already shows,
    # instead of a single static "loading" label.
    def event_generator():
        try:
            for update in get_ocean_state_streaming(lat, lon):
                yield f"data: {json.dumps(update)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'step': 'error', 'done': True, 'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


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
