# OceanEmbed

**Deep ocean data, reconstructed from what satellites can actually see.**

Satellites only observe the sea *surface* — temperature, height, salinity, wind. What's happening at 500 m or 1000 m depth is invisible to them, and the direct measurements that do exist (Argo floats) are sparse and slow to arrive. OceanEmbed trains a model on real Argo profiles to reconstruct the full subsurface temperature profile (0–1000 m) from live surface satellite data, then serves that prediction — plus the real surface conditions it was computed from — through a web app and a public API.

Every number shown anywhere in this project — on the site, in the API responses, in this README — is either a real trained-model output or pulled live from a real data provider (Copernicus Marine, Argo). Nothing is simulated or placeholder.

**Live validated accuracy:** 0.637°C RMSE (Bay of Bengal) · 0.834°C RMSE (Arabian Sea), against held-out real Argo float measurements.

---

## What's in this repo

```
oceanembed-clean-v2/
├── ocean-hero-app/          the whole product: Next.js frontend + FastAPI backend
│   ├── app/                 pages (see below)
│   ├── components/          React components (map, panels, charts, hero animation)
│   ├── lib/                 shared frontend helpers (data fetching, permalinks)
│   ├── backend/              FastAPI service: live predictions, ocean-state, Argo lookups
│   │   ├── main.py            HTTP routes + SSE streaming + per-IP rate limiting
│   │   ├── live_predict.py    model inference + live Copernicus data fetches
│   │   └── models/            trained model weights (PyTorch) + normalization stats
│   └── public/data/          precomputed real datasets (confidence grids, seasonal profiles)
└── demo/                    a narrated CLI script that replays the model's real training history
```

## Pages

| Page | What it does |
|---|---|
| **/** | Scroll-driven explainer: a satellite, a boat and an Argo float sinking through the water column as you scroll, telling the "surface data isn't enough" story. |
| **/solution** | The main workstation. Pick a point on a real map of the Bay of Bengal / Arabian Sea (or click anywhere), toggle Historical (validated against real Argo) vs. Live (fetched fresh, right now), and Surface vs. Under-Surface temperature. Includes an SST heatmap, a model-confidence overlay, a real Argo Float Tracker, a Recent Validation Calendar, seasonal time-lapse, CSV export and shareable result permalinks. |
| **/intelligence** | Four domain-specific views (Fisheries, Ocean Health, Offshore Operations, Maritime routing) built on the same live ocean-state data, each translating raw readings into decision-support language for that use case. |
| **/technology** | The model architecture, training methodology and validation numbers. |
| **/api-docs** | Public documentation for the live API — real tested requests/responses, honest timing expectations, error behavior. |
| **/data** | About the project and team. |

## The backend, briefly

A FastAPI service (`ocean-hero-app/backend/`) exposes:

- `GET /api/live-predict/stream?lat=&lon=` — streams (SSE) a live subsurface temperature prediction for a point, built from a live Copernicus Marine fetch running through the trained model.
- `GET /api/ocean-state?lat=&lon=` / `/api/ocean-state/stream` — the full real surface + subsurface + derived ocean state at a point (temperature, salinity, currents, wind, sea level, and a climatology reference where available).
- Several Argo-float lookup endpoints (dates with data, floats by date, float track, nearby recent measurements) used to power the map's validation and float-tracking features.

**Live requests are genuinely slow (typically 5–90+ seconds)** — each one fetches fresh data from an upstream provider before running the model, no shortcuts. The API is public with no authentication, protected only by a per-IP rate limit (5 requests/minute on the live endpoints) since each call has a real upstream cost. Full docs, real example requests and their actual captured responses live at `/api-docs`.

## Running it locally

**Frontend** (Node 18.18+):
```bash
cd ocean-hero-app
npm install
npm run dev        # http://localhost:3000
```

**Backend** (Python, CPU-only PyTorch):
```bash
cd ocean-hero-app/backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

The frontend talks to the backend at `http://localhost:8000` by default; set `NEXT_PUBLIC_LIVE_API_BASE` to point it elsewhere (e.g. a deployed backend) in production.

## The model

Two region-specific PyTorch MLPs (Bay of Bengal, Arabian Sea) predict a 15-depth temperature profile (0–1000 m) from real surface inputs. Each was reached by iterating on real, Argo-validated RMSE — adding regional clustering, wind-stress curl, mixed layer depth, salinity and eddy vorticity as inputs where they genuinely improved held-out accuracy, and rejecting the ideas that didn't. That real iteration history (what was tried, what worked, what was honestly discarded) is detailed on `/technology` and replayed by `demo/demo_journey.py`.

## Tech stack

Next.js 15 (App Router) · React 19 · TypeScript · hand-rolled SVG map & charts (no charting library) · FastAPI · PyTorch (CPU) · xarray/netCDF4 · Copernicus Marine (`copernicusmarine`) for live satellite/reanalysis data · real Argo float profiles for training and validation.
