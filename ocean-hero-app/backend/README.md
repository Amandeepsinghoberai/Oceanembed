# OceanEmbed — Live Prediction Backend

FastAPI service behind the "Get Live Prediction" button on `/solution`. It
fetches today's real satellite data from Copernicus Marine, runs it through
the actual trained model, and streams progress back over Server-Sent Events.
See `../COWORK_TASK_V3_LIVE_MODE.md` for the full design.

## `models/` is not committed

This folder is `.gitignore`d (`processed_sst_full.nc` alone is ~272MB — over
GitHub's 100MB per-file limit) and must be populated manually before the
backend will start. **The exact 10 files needed, and where they come from,
are listed in `COWORK_TASK_V3_LIVE_MODE.md`, Step 1** — copy them from
`oceanembed-ml/data/` into `backend/models/` as described there.

## Setup

```bash
cd backend
python -m venv .venv
.venv/Scripts/activate        # Windows; use `source .venv/bin/activate` on macOS/Linux
pip install -r requirements.txt
```

Populate `models/` (see above), then authenticate with Copernicus Marine —
**this is a one-time manual step, not something the code can do for you**:

```bash
copernicusmarine login
```

Without this, live prediction requests will fail with an authentication
error. This is expected until login is done on whichever machine runs the
backend.

## Run

```bash
uvicorn main:app --reload --port 8000
```

The frontend (`components/solution/AnalysisPanel.jsx`) expects this at
`http://localhost:8000`.
