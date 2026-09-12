# OceanEmbed — Cowork Task: Add Live Prediction Mode

*This is additive work — nothing gets deleted. Read fully before starting. Ask before deviating from anything below.*

---

## Context

The web app currently shows 5 pre-cached historical predictions (built in the previous task). This task adds a **second, real-time mode**: clicking "Get Live Prediction" on any of the 5 known points fetches today's real satellite data, runs it through the actual trained AI model, and shows a genuine live result — typically 5-15 seconds for Bay of Bengal, 30-90 seconds for Arabian Sea, because it's making real network calls to Copernicus Marine's live data servers, not reading a local file.

**The 5 offline historical points remain the default, guaranteed, instant view — this task only adds an optional "go live" button on top.** Never remove or weaken the existing offline flow.

**Critically: the progress messages shown while waiting must be REAL, not a fake timed animation.** Each message must appear exactly when that specific real data fetch actually completes — this is the whole point, it's proof to a judge that real data is being fetched, not decoration. Bay of Bengal shows a 2-step sequence (fewer real fetches needed); Arabian Sea shows a 5-step sequence (more real fetches needed) — this difference is intentional and must be preserved, not equalized.

---

## Step 1 — Set Up the Python Backend (new)

This project currently has no backend — only the Next.js frontend. Live prediction requires Python (PyTorch model, `copernicusmarine` library), so create a small FastAPI service alongside the frontend:

```
ocean-hero-app/
  backend/              <- new folder
    main.py
    live_predict.py     <- provided, copy as-is from oceanembed-ml
    models/
      best_mlp_cluster.pt
      normalization_stats_cluster.npz
      depth_bias_correction_cluster.csv
      cluster_map.npy
      processed_sst_4yr.nc
      best_mlp_arabian_eddy.pt
      normalization_stats_arabian_eddy.npz
      depth_bias_correction_arabian_eddy.csv
      cluster_map_arabian_curl.npy
      processed_sst_full.nc
    requirements.txt
```

All files under `models/` are provided alongside this brief (copied from `oceanembed-ml/data/`) — ask if any are missing rather than substituting or inventing one.

`requirements.txt`:
```
fastapi
uvicorn
torch
xarray
numpy
pandas
copernicusmarine
netCDF4
```

**Important setup note to flag to the user, don't just silently assume it's handled:** `copernicusmarine` requires valid login credentials to be configured on whichever machine runs this backend (`copernicusmarine login`). If this hasn't been done on the deployment machine, live mode will fail with an authentication error — this is expected and needs a one-time manual login, not a code fix.

## Step 2 — Refactor `predict_live()` to Report Real Progress

The existing `predict_live(lat, lon)` function (in the provided `live_predict.py`) does all its fetches silently, then returns one final result. Refactor it into a **generator function** that yields a progress message after each real step completes, so the frontend can show genuine live progress via Server-Sent Events (SSE):

```python
# In live_predict.py, add this alongside the existing predict_live function
# (keep the original function too, other code may still use it)

def predict_live_streaming(lat, lon):
    """
    Same logic as predict_live(), but yields a status message after each
    real step actually completes, instead of returning silently at the end.
    Used to show genuine live progress to the user - each message is only
    yielded once that specific real network fetch has actually finished.
    """
    if lon < BAY_LON_MIN:
        yield {"step": "Fetching live sea surface temperature...", "done": False}
        sst_path, sst_date = _fetch_latest("METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2", "analysed_sst", lat, lon, "live_sst.nc")

        yield {"step": "Fetching live sea level data...", "done": False}
        ssh_path, ssh_date = _fetch_latest("cmems_obs-sl_glo_phy-ssh_nrt_allsat-l4-duacs-0.125deg_P1D", "sla", lat, lon, "live_ssh.nc")

        yield {"step": "Fetching live salinity data...", "done": False}
        sss_path, sss_date = _fetch_latest("cmems_obs-mob_glo_phy-sss_nrt_multi_P1D", "sos", lat, lon, "live_sss.nc")

        yield {"step": "Fetching live mixed layer depth...", "done": False}
        mld_path, mld_date = _fetch_latest("cmems_mod_glo_phy_anfc_0.083deg_P1D-m", "mlotst", lat, lon, "live_mld.nc")

        yield {"step": "Fetching live wind data and computing ocean rotation...", "done": False}
        curl_path, curl_date = _fetch_latest("cmems_obs-wind_glo_phy_nrt_l4_0.125deg_PT1H", "stress_curl", lat, lon, "live_curl.nc", hourly=True)

        # ... (rest of the existing Arabian Sea extraction/prediction logic from
        # predict_live goes here unchanged, producing `result` as before)

        yield {"step": "complete", "done": True, "result": result}

    else:
        yield {"step": "Fetching live sea surface temperature...", "done": False}
        sst_path, sst_date = _fetch_latest("METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2", "analysed_sst", lat, lon, "live_sst_bay.nc")

        yield {"step": "Fetching live sea level data...", "done": False}
        ssh_path, ssh_date = _fetch_latest("cmems_obs-sl_glo_phy-ssh_nrt_allsat-l4-duacs-0.125deg_P1D", "sla", lat, lon, "live_ssh_bay.nc")

        # ... (rest of the existing Bay of Bengal extraction/prediction logic
        # from predict_live goes here unchanged, producing `result` as before)

        yield {"step": "complete", "done": True, "result": result}
```

**Do not change the actual fetching/prediction logic itself** — only restructure it to yield progress between steps. The dataset IDs, model loading, and math must stay exactly as already proven working.

## Step 3 — FastAPI Endpoint (Server-Sent Events)

`backend/main.py`:

```python
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
        for update in predict_live_streaming(lat, lon):
            yield f"data: {json.dumps(update)}\n\n"
    return StreamingResponse(event_generator(), media_type="text/event-stream")
```

Run with: `uvicorn main:app --reload --port 8000` (from inside `backend/`)

## Step 4 — Frontend: "Get Live Prediction" Button

Add a button to the existing point-detail panel (`AnalysisPanel.jsx`), alongside the historical result already shown. Clicking it:

1. Opens a connection to `http://localhost:8000/api/live-predict/stream?lat={lat}&lon={lon}` using the browser's `EventSource` API
2. Displays each incoming step message as it arrives — a simple animated checklist works well (each step appears, shows a spinner, then a checkmark when the *next* message arrives)
3. When the `"complete"` message arrives, display the live result: same profile chart component already built, plus the surface state fields, but **no Argo comparison line and no metrics row** — live mode has no ground truth yet, and the UI must not pretend otherwise (no fabricated confidence/accuracy numbers for the live result)
4. Label this result clearly, e.g. "LIVE — [today's real date from the response] — not yet validated against Argo (validation requires several weeks after real Argo data is published)"

Example minimal client-side pattern:

```jsx
const [liveSteps, setLiveSteps] = useState([]);
const [liveResult, setLiveResult] = useState(null);

function getLivePrediction(lat, lon) {
  setLiveSteps([]);
  setLiveResult(null);
  const source = new EventSource(`http://localhost:8000/api/live-predict/stream?lat=${lat}&lon=${lon}`);
  source.onmessage = (event) => {
    const update = JSON.parse(event.data);
    if (update.done) {
      setLiveResult(update.result);
      source.close();
    } else {
      setLiveSteps(prev => [...prev, update.step]);
    }
  };
}
```

---

## Non-Negotiables

- The 5 offline historical points must continue working exactly as before, with zero changes to that flow
- Live mode is always an explicit, opt-in click — never triggered automatically
- Progress messages must be tied to real completed fetches, not a timer or fake animation
- Never show a fabricated RMSE/confidence/Argo comparison for a live result — there genuinely isn't one yet
- If the live fetch fails (network issue, Copernicus servers down, missing login credentials), show a clear error state — never silently fall back to showing historical data as if it were live

## If Anything Is Unclear

Ask before proceeding — especially if `copernicusmarine` isn't authenticated on the deployment machine, if any of the model files are missing, or if the existing `AnalysisPanel.jsx` layout doesn't have an obvious place for the new button without disrupting the historical view.
