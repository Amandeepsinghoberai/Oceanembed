# OceanEmbed — Cowork Task: Real Backend for the Intelligence Page

*This replaces the placeholder/dead data providers currently causing 404 loops on the Intelligence page. All data returned must be real — live-fetched, model-predicted, or honestly marked unavailable. Never fabricate a value.*

---

## Context

The Intelligence page's spec (`OceanEmbed_Intelligence_Data_Requirements.txt`, attached) defines exactly what real data each of the 4 modules (Fisheries, Ocean Health, Offshore, Maritime) needs. This task builds **one real, normalized backend endpoint** that all 4 modules should consume, replacing the current per-module providers that are hitting dead, non-existent file paths in an infinite retry loop.

**First, stop the bleeding:** find and fix whatever is causing the current 404 requests (`copernicus_*.meta.json`, `hycom_*.meta.json`, `smap_*.meta.json`, etc.) to repeat every few hundred milliseconds. Whatever polling/retry logic exists there must stop — either by removing it entirely in favor of the new endpoint below, or, at minimum, failing once and stopping.

## The Real Data We Actually Have (use these, nothing else)

- **Subsurface temperature T(z), 0-1000m:** your existing `predict_live()` function in `live_predict.py` — for Bay of Bengal or Arabian Sea, based on which region the point falls in (same `_classify_region()` logic already used elsewhere in this backend). This IS the `"source": "OceanEmbed"` data the spec requires.
- **SST, SSH:** already fetched inside `predict_live()` for both regions.
- **SSS:** already fetched for Arabian Sea points. For Bay of Bengal points, fetch it too, purely as page context (`cmems_obs-mob_glo_phy-sss_nrt_multi_P1D`, `sos` variable) — the Bay of Bengal *model* doesn't use SSS as an input, but this page can still show the real, live value.
- **Current U/V (NEW, but a confirmed, working dataset):** `cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m`, variables `uo` and `vo`. Fetch live, same `_fetch_latest()` retry pattern already used for every other live variable in this file.
- **Reference/baseline temperature for "true anomaly":** `models/glorys_climatology_trainonly.nc` (provided, copied into `backend/models/`). This gives an expected/typical temperature for a given point, depth, and day-of-year, built from 3 years of real GLORYS training data.
  - **This file only covers the Bay of Bengal region.** For Arabian Sea points, there is no real reference/climatology yet — return `"reference": null` and `"same_depth": false` honestly, do not approximate or reuse the Bay of Bengal climatology for Arabian Sea points.

## The New Endpoint

Add to `backend/main.py`:

```python
@app.get("/api/ocean-state")
async def ocean_state(lat: float, lon: float):
    # Build and return the normalized response shape below.
    # Reuse predict_live() and its region classification - do not
    # duplicate the model-loading or fetch logic.
```

**Response shape — follow this exactly, it matches the spec document's Section 11:**

```json
{
  "location": {"lat": 15.2, "lon": 72.8},
  "surface": {
    "sst_c": 27.1,
    "sss_psu": 35.1,
    "current_u_ms": 0.18,
    "current_v_ms": 0.31,
    "ssh_m": 0.42
  },
  "subsurface": {
    "source": "OceanEmbed",
    "depth_m": [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000],
    "temperature_c": [27.1, 27.0, 26.9, "...(actual values)..."],
    "valid": true
  },
  "reference": {
    "source": "GLORYS climatology (Bay of Bengal only)",
    "temperature_c_by_depth": [26.8, 26.7, "..."],
    "same_depth": true
  },
  "derived": {
    "current_speed_ms": 0.36,
    "current_direction_deg": 59.7,
    "vertical_gradient_c_per_m": [/* per-depth-interval gradient, see below */]
  },
  "provenance": ["OSTIA", "GLORYS", "OceanEmbed"]
}
```

**If any real value is unavailable for this point** (out of region coverage, a fetch fails, no climatology for this region), set that specific field to `null` and remove its source from `provenance` — never fill in a plausible-looking number. If subsurface prediction itself fails (point outside real model coverage), set `subsurface.valid: false` and leave `temperature_c: null` — this is the literal trigger for the frontend's existing "INSUFFICIENT DATA" states.

## Derived Calculations (backend, not frontend — keep this logic in one place)

- **Current speed:** `sqrt(u² + v²)`
- **Current direction:** standard vector-to-compass-bearing conversion from u/v
- **Vertical temperature gradient:** `(T[i+1] - T[i]) / (depth[i+1] - depth[i])` for each consecutive depth pair — return as an array one element shorter than `depth_m`
- **True anomaly** (only when `reference` is available): `subsurface.temperature_c[i] - reference.temperature_c_by_depth[i]` at each matching depth — compute this and add it as `derived.temperature_anomaly_c` (array, same length as depth, `null` at any depth without a valid reference)

## Non-Negotiables (directly from the spec document — do not deviate)

- Never label GLORYS/HYCOM/climatology data as "OceanEmbed prediction" — only the actual model's output gets that label
- Never fabricate a value for a missing reading — use `null` and let the frontend's existing honest empty-states handle it
- Arabian Sea points must honestly show no reference/anomaly data available — do not substitute the Bay of Bengal climatology
- This endpoint's real fetches will take real time (same 5-90 second range as the existing `/api/live-predict/stream` endpoint, since it's doing the same kind of live network calls, now with one more variable added). If the Intelligence page needs faster response, that's a frontend loading-state/UX decision, not a reason to fake instant data here.

## Verify

- Call `/api/ocean-state?lat=15.0&lon=88.0` (Bay of Bengal) — confirm real values throughout, including a real, non-null `reference` and `temperature_anomaly_c`
- Call `/api/ocean-state?lat=17.0&lon=58.0` (Arabian Sea) — confirm real subsurface/surface values, but `reference: null` and `same_depth: false`, honestly
- Call a point outside both regions — confirm `subsurface.valid: false`, not an error or a crash
- Confirm the old 404-looping requests are completely gone from the console/network tab once this is wired in
- Confirm the Fisheries "INSUFFICIENT DATA" state (already built) now correctly reflects real missing data from this endpoint, not the old dead file paths

## If Anything Is Unclear

Ask before proceeding — especially about exact current-direction convention (compass bearing vs. mathematical angle — check what the Maritime module's existing UI expects, if it already assumes one), or if any of the 4 Intelligence modules' existing frontend code expects a different field naming than what's specified here (adapt the frontend to this real shape, don't invent mismatched backend fields to match old placeholder assumptions).
