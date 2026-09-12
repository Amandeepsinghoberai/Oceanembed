from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import json
from live_predict import predict_live_streaming

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
