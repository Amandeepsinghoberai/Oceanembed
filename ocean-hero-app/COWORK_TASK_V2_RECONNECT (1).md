# OceanEmbed — Cowork Task: Reconnect Frontend to Real Model Output

*This is a surgical fix, not a fresh build. Read this fully before making any changes. Ask before deviating from anything below.*

---

## What's Actually Wrong (Context — Read This First)

This project (`ocean-hero-app`) currently has a data layer that fetches **live, raw ocean data** (SST, salinity, currents, wind, a HYCOM depth profile) directly — with **zero connection to the project's actual trained AI model.** The depth-profile feature specifically only works near one hardcoded location (15°N, 65°E) and shows a raw ocean simulation reading, not an AI prediction.

**This is the wrong architecture.** The real project is: an AI model, trained and validated over months, that predicts 15-depth temperature profiles and is checked against real Argo float measurements — RMSE 0.637°C (Bay of Bengal) and 0.834°C (Arabian Sea). None of that currently appears anywhere in this app. The task is to fix that.

---

## Step 1 — Delete the Old Data Layer

Remove these files entirely — none of them connect to the real project and none should be referenced anywhere after this task:

```
ocean-hero-app/data/MockOceanDataProvider.js
ocean-hero-app/data/RealCurrentDataProvider.js
ocean-hero-app/data/RealGLORYSDataProvider.js
ocean-hero-app/data/RealOceanDataProvider.js
ocean-hero-app/data/RealProfileDataProvider.js
ocean-hero-app/data/RealSalinityDataProvider.js
ocean-hero-app/data/RealSSTDataProvider.js
ocean-hero-app/data/RealWindDataProvider.js
ocean-hero-app/data/solutionData.js   (check first — if this holds real static content like team info or copy text unrelated to ocean data fetching, keep it; if it's part of the fake data layer, remove it)
ocean-hero-app/scripts/convert-sst-to-binary.py
ocean-hero-app/scripts/fetch_noaa.py
ocean-hero-app/scripts/process_production_sst.py
ocean-hero-app/scripts/process_regional_sst.py
ocean-hero-app/scripts/report_production_nc.py
ocean-hero-app/scripts/report_salinity_nc.py
ocean-hero-app/scripts/report_tile_nc.py
ocean-hero-app/scripts/validate_nc.py
ocean-hero-app/app/sst-test/  (entire folder — a test page for the old provider, no longer needed)
ocean-hero-app/noaa_oisst.nc
ocean-hero-app/ostia_arabian_3day.nc
ocean-hero-app/ostia_arabian_test.nc
ocean-hero-app/cmems_describe.json
ocean-hero-app/parse_cmems.py
ocean-hero-app/parse_describe.py
ocean-hero-app/eval_proj.js
ocean-hero-app/temp-filter.js
ocean-hero-app/public/data/sst/          (entire folder)
ocean-hero-app/public/data/currents/     (entire folder)
ocean-hero-app/public/data/glorys/       (entire folder)
ocean-hero-app/public/data/salinity/     (entire folder)
ocean-hero-app/public/data/wind/         (entire folder)
ocean-hero-app/public/data/profile/      (entire folder)
ocean-hero-app/public/data/ostia_arabian_3day.bin
ocean-hero-app/public/data/ostia_arabian_3day.json
ocean-hero-app/public/data/ostia_arabian_3day.meta.json
ocean-hero-app/public/data/ostia_arabian_test.json
ocean-hero-app/public/data/ostia_test_sample.json
```

**Do NOT delete from `public/data`:** `indianOcean.geojson`, `world.geojson`, `world.json` (these are map boundary/coastline data, unrelated to ocean measurements — needed for rendering the map itself), `oceanembed-logo.png`, `oceanembed-logo-v2.png`, `.gitkeep`.

**Do NOT delete:** `OceanHero.jsx`, `INTEGRATION.md`, `reference/ocean-hero.html`, anything in `app/` or `components/` not listed above, `package.json`, `next.config.ts`, `.gitignore`, or any other standard Next.js project file.

## Step 2 — Add the Real Demo Data

Copy these 5 files (provided alongside this brief — ask if they're not already in this folder) into `public/data/` — alongside the geojson/logo files that are staying, replacing the raw folders removed in Step 1:

```
ocean-hero-app/public/data/demo_1.json
ocean-hero-app/public/data/demo_2.json
ocean-hero-app/public/data/demo_3.json
ocean-hero-app/public/data/demo_4.json
ocean-hero-app/public/data/demo_5.json
```

These are the **real, validated outputs** of the actual trained AI models — real predictions, real Argo comparisons, real confidence values. This is the only data that should ever be shown as "our model's prediction" anywhere in the app.

**Exact shape of each file:**

```json
{
  "location": { "lat": 13.14, "lon": 86.75, "region": "Bay of Bengal" },
  "date": "2023-01-26",
  "surface_state": { "sst_c": 26.89, "ssh_m": -0.022 },
  "profile": {
    "depths_m": [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000],
    "pressure_dbar": [-0.0, 5.0, 10.1, "...(13 more)"],
    "predicted_temp_c": [26.89, 26.83, "...(13 more)"],
    "argo_temp_c": [26.83, 26.77, "...(13 more)"],
    "confidence_pct": [87.1, 86.6, "...(13 more)"]
  },
  "metrics": { "rmse_c": 0.472, "bias_c": -0.229, "correlation": 0.998 }
}
```

**`surface_state` has 2 fields for Bay of Bengal points and 6 fields for Arabian Sea points** (adds `wind_stress_curl`, `mld_m`, `sss_psu`, `eddy_vorticity`). Any UI showing surface state must render whatever keys are actually present, not assume a fixed shape — this reflects a real, deliberate project decision (the two regions use different validated models), not an inconsistency to normalize away.

## Step 3 — Build One New, Simple Provider

Create `ocean-hero-app/data/ModelResultsProvider.js`. Its only job: load the 5 JSON files and let components look one up by clicking a point.

```js
// data/ModelResultsProvider.js
class ModelResultsProviderClass {
  constructor() {
    this.results = [];
    this.isLoaded = false;
  }

  async load() {
    if (this.isLoaded) return;
    const files = ['demo_1.json', 'demo_2.json', 'demo_3.json', 'demo_4.json', 'demo_5.json'];
    this.results = await Promise.all(
      files.map(f => fetch(`/data/${f}`).then(r => r.json()))
    );
    this.isLoaded = true;
  }

  getAllLocations() {
    return this.results.map(r => ({ lat: r.location.lat, lon: r.location.lon, region: r.location.region, date: r.date }));
  }

  getResult(lat, lon, date) {
    return this.results.find(r => r.location.lat === lat && r.location.lon === lon && r.date === date) || null;
  }
}

export const ModelResultsProvider = new ModelResultsProviderClass();
```

Adjust only if the existing components' expected call patterns genuinely require a different method signature — keep the underlying logic (load 5 static files, look one up by exact match) the same either way.

## Step 4 — Rewire the 3 Components That Use the Old Providers

These three files currently import and call the deleted providers. Each needs its imports and data-fetching logic updated to use `ModelResultsProvider` instead. **The visual design/layout of these components should stay as close to their current look as possible — this is a data-source swap, not a redesign.**

- **`components/solution/AnalysisPanel.jsx`** — currently loads 6 separate live providers (SST, salinity, current, GLORYS fallback, profile, wind) and combines them. Replace all of that with one `ModelResultsProvider.load()` call, then read `surface_state`, `profile`, and `metrics` directly from the matched result for display.
- **`components/solution/RealOceanMap.jsx`** — currently renders a live SST heatmap grid. **Important scope note:** the real model's output is per-point predictions, not a full rendered grid — replace the heatmap with markers at exactly the 5 real demo locations from `ModelResultsProvider.getAllLocations()`. Clicking a marker should show that point's real result. Do not attempt to reconstruct a full-grid heatmap from this data — that's a legitimate future feature, not something to fake now.
- **`components/solution/SolutionWorkspace.jsx`** — currently calls `RealSSTDataProvider.load()` and reads available dates from it. Replace with `ModelResultsProvider.load()` and derive the date list from `getAllLocations()` instead.

## Step 5 — Verify

- App builds and runs with `npm run dev`, no console errors referencing any deleted provider
- Clicking each of the 5 markers shows that point's real predicted profile, real Argo comparison, real metrics — not a live/raw value
- An Arabian Sea point's surface panel shows 6 fields; a Bay of Bengal point's shows 2 — both correctly, without errors
- No file anywhere in the project still fetches from `hycom`, `noaa`, `era5`, `gfs`, or any raw `.nc`/`.bin` path

---

## Non-Negotiables

- Every number shown as a "prediction" must come from the 5 real JSON files — never a live fetch, never a fallback to a different data source, never a hardcoded value
- Do not reintroduce any live/raw ocean data fetching anywhere in this app
- `OceanHero.jsx` and the scroll animation are unrelated to this task — do not modify them
- If a component's current behavior can't be cleanly replicated with only 5 fixed points (e.g., it currently lets a user click anywhere on a live map), don't invent new data to fill the gap — restrict the interaction to the 5 real points and note the limitation, rather than fabricating anything

## If Anything Is Unclear

Ask before proceeding — especially if `solutionData.js` turns out to hold something worth keeping, if a component has logic beyond what's described here, or if removing a file breaks an import you weren't expecting.
