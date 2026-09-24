import copernicusmarine
import xarray as xr
import numpy as np
import torch
import torch.nn as nn
import pandas as pd
import requests
import os
import re
import time
import uuid
from datetime import datetime, timedelta, timezone

depths = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
BAY_LON_MIN = 80.0  # real western edge of the Bay grid; 77-80E is a genuine coverage gap
ARABIAN_LON_MAX = 77.0  # exclusive
BAY_LON_MAX = 100.0
ARABIAN_LON_MIN = 45.0
LAT_MIN = 5.0
LAT_MAX = 30.0

LIVE_DIR = "data/live_cache"
os.makedirs(LIVE_DIR, exist_ok=True)


class MLP(nn.Module):
    def __init__(self, n_inputs):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(n_inputs, 48), nn.ReLU(), nn.Dropout(0.15),
            nn.Linear(48, 48), nn.ReLU(), nn.Dropout(0.15),
            nn.Linear(48, 15)
        )
    def forward(self, x):
        return self.net(x)


def _classify_region(lat, lon):
    """Real, validated bounds only. Anything outside gets no model, ever."""
    if lat < LAT_MIN or lat > LAT_MAX:
        return None
    if ARABIAN_LON_MIN <= lon < ARABIAN_LON_MAX:
        return "arabian"
    if BAY_LON_MIN <= lon <= BAY_LON_MAX:
        return "bay"
    return None  # the 77-80E gap, or anything else outside real coverage


# ---------- Load both models once, at import time ----------
print("Loading trained models...")

bay_model = MLP(n_inputs=7).to(device)
bay_model.load_state_dict(torch.load("models/best_mlp_cluster.pt", map_location=device))
bay_model.eval()
bay_norm = np.load("models/normalization_stats_cluster.npz")
bay_correction = dict(zip(
    pd.read_csv("models/depth_bias_correction_cluster.csv")["depth"],
    pd.read_csv("models/depth_bias_correction_cluster.csv")["correction_c"]
))
bay_cluster_map = np.load("models/cluster_map.npy")
_bay_grid = xr.open_dataarray("models/processed_sst_4yr.nc")
bay_grid_lats, bay_grid_lons = _bay_grid.latitude.values, _bay_grid.longitude.values

arabian_model = MLP(n_inputs=16).to(device)
arabian_model.load_state_dict(torch.load("models/best_mlp_arabian_eddy.pt", map_location=device))
arabian_model.eval()
arabian_norm = np.load("models/normalization_stats_arabian_eddy.npz")
arabian_correction = dict(zip(
    pd.read_csv("models/depth_bias_correction_arabian_eddy.csv")["depth"],
    pd.read_csv("models/depth_bias_correction_arabian_eddy.csv")["correction_c"]
))
arabian_cluster_map = np.load("models/cluster_map_arabian_curl.npy")
_ar_grid = xr.open_dataarray("models/processed_sst_full.nc").sel(longitude=slice(None, ARABIAN_LON_MAX))
ar_grid_lats, ar_grid_lons = _ar_grid.latitude.values, _ar_grid.longitude.values

# Real GLORYS climatology (day-of-year x depth x lat x lon), built from 3
# years of real GLORYS training data — the "reference" baseline for true
# subsurface anomaly. Its own real coverage is Bay of Bengal only, and only
# up to ~22N (narrower than the model's own 5-30N Bay region) — checked at
# lookup time, never assumed. Kept lazy (not .load()ed into memory), same as
# the SST grids above. A missing/unreadable file must not take down the
# rest of the backend — reference/anomaly just becomes honestly unavailable.
try:
    _climatology_da = xr.open_dataset("models/glorys_climatology_trainonly.nc")["__xarray_dataarray_variable__"]
    CLIMATOLOGY_LAT_MAX = float(_climatology_da.latitude.max())
except Exception as e:
    print(f"Could not load GLORYS climatology ({e}) — reference/anomaly will be unavailable.")
    _climatology_da = None
    CLIMATOLOGY_LAT_MAX = None

print("Models loaded.\n")


def _get_cluster_id(lat, lon, cluster_map, grid_lats, grid_lons):
    lat_idx = np.argmin(np.abs(grid_lats - lat))
    lon_idx = np.argmin(np.abs(grid_lons - lon))
    return int(cluster_map[lat_idx, lon_idx])


_LIVE_CACHE_MAX_AGE_S = 3600
_UNIQUE_CACHE_FILE_RE = re.compile(r"_[0-9a-f]{8}\.nc$")
_live_cache_last_swept = 0.0


def _sweep_live_cache():
    """Deletes this module's own per-call cache files (the unique-suffixed
    live_*/ocean_state_* .nc files) once they are an hour old, at most every
    10 minutes. Touches nothing else in LIVE_DIR (Argo index, older files)."""
    global _live_cache_last_swept
    now = time.time()
    if now - _live_cache_last_swept < 600:
        return
    _live_cache_last_swept = now
    try:
        for name in os.listdir(LIVE_DIR):
            if name.startswith(("live_", "ocean_state_")) and _UNIQUE_CACHE_FILE_RE.search(name):
                path = os.path.join(LIVE_DIR, name)
                try:
                    if now - os.path.getmtime(path) > _LIVE_CACHE_MAX_AGE_S:
                        os.remove(path)
                except OSError:
                    pass
    except OSError:
        pass


def _fetch_latest(dataset_id, variable, lat, lon, filename, max_days_back=14, hourly=False,
                   min_depth=None, max_depth=None, start_days_back=2):
    """Tries progressively older dates until the live dataset actually has data.

    min_depth/max_depth are optional and only needed for a genuinely 3D
    product (e.g. the current U/V dataset, which carries multiple depth
    levels) — omitted entirely for every existing 2D/surface-only caller,
    so their behavior is unchanged.

    start_days_back lets a caller skip straight past days a specific
    dataset is known (from real, repeated observation) to never have yet -
    e.g. the multi-satellite SSS product below, whose own server-side
    warning during testing confirmed a ~6-day publication lag. Every other
    call site omits this and keeps the original day-2 starting point, so
    their behavior is byte-for-byte unchanged; this still falls back to
    trying every later day up to max_days_back if the assumed lag is ever
    wrong, so it can never turn "no fresh data" into a false negative.

    `filename` is only a label: every call writes to its own unique file and
    returns that exact path. copernicusmarine.subset() otherwise silently
    renames on a name collision (live_sst_(1).nc, ...), while a fixed name kept
    being read back - so every fetch after the first returned the FIRST point's
    stale file, and concurrent requests could read each other's data.
    """
    _sweep_live_cache()
    today = datetime.now(timezone.utc).date()
    stem, ext = os.path.splitext(filename)
    unique_name = f"{stem}_{uuid.uuid4().hex[:8]}{ext}"
    out_path = f"{LIVE_DIR}/{unique_name}"

    for days_back in range(start_days_back, max_days_back + 1):
        target_date = today - timedelta(days=days_back)
        start = f"{target_date}T12:00:00" if hourly else str(target_date)
        end = start
        try:
            kwargs = dict(
                dataset_id=dataset_id, variables=[variable],
                minimum_longitude=lon - 0.5, maximum_longitude=lon + 0.5,
                minimum_latitude=lat - 0.5, maximum_latitude=lat + 0.5,
                start_datetime=start, end_datetime=end,
                output_directory=LIVE_DIR, output_filename=unique_name, overwrite=True,
            )
            if min_depth is not None:
                kwargs["minimum_depth"] = min_depth
            if max_depth is not None:
                kwargs["maximum_depth"] = max_depth
            copernicusmarine.subset(**kwargs)
            return out_path, target_date
        except Exception:
            continue
    raise RuntimeError(f"Could not fetch {variable} from {dataset_id} within {max_days_back} days")


# ---------- Recent real Argo lookup (context only, not validation) ----------
_argo_index_cache = None
_argo_index_loaded_at = 0.0
_ARGO_INDEX_MAX_AGE_S = 24 * 3600

def _load_argo_index():
    global _argo_index_cache, _argo_index_loaded_at
    # A long-running server must not serve a days-old index forever (the
    # "floats in the last 7 days" ticker and the validation calendar both
    # depend on it being current) - re-read after 24h. If the refresh fails,
    # keep serving the older real copy rather than failing outright.
    if _argo_index_cache is not None and (time.time() - _argo_index_loaded_at) > _ARGO_INDEX_MAX_AGE_S:
        previous = _argo_index_cache
        _argo_index_cache = None
        try:
            return _load_argo_index()
        except Exception:
            _argo_index_cache = previous
            return previous
    if _argo_index_cache is None:
        index_path = f"{LIVE_DIR}/argo_index_latest.txt"
        # Reuse an on-disk copy from the last day instead of re-fetching this
        # ~300MB index on every process restart. This also means a transient
        # network failure here doesn't take the whole feature down as long as
        # we already have a recent copy - a real gap found in production: a
        # server restart with no cached file, hitting a network blip on this
        # one big download, silently looked identical to "no floats nearby"
        # for every request afterward.
        fresh_on_disk = (
            os.path.exists(index_path)
            and (time.time() - os.path.getmtime(index_path)) < 24 * 3600
        )
        if not fresh_on_disk:
            url = "https://data-argo.ifremer.fr/ar_index_global_prof.txt"
            r = requests.get(url, timeout=60)
            r.raise_for_status()
            with open(index_path, "wb") as f:
                f.write(r.content)
        _argo_index_cache = pd.read_csv(index_path, comment="#")
        _argo_index_cache["date"] = pd.to_datetime(
            _argo_index_cache["date"], format="%Y%m%d%H%M%S", errors="coerce"
        )
        _argo_index_loaded_at = time.time()
    return _argo_index_cache


def find_nearest_recent_argo(target_lat, target_lon, max_days=30, max_distance_deg=2.0):
    """
    Finds the closest real, recent Argo profile to a given point - shown as
    honest supporting context alongside a live prediction. This is NOT a
    validation of the live number (different date, different exact location) -
    it's real, nearby, recent ocean truth, clearly labeled as such.

    Always returns a dict with a "status" key - "found", "none_nearby", or
    "lookup_failed". Distinguishing the last two matters: fetching the index
    or a candidate's profile file over the network can fail (a real, observed
    failure mode - see the 300MB index download and per-profile fetches both
    timing out against data-argo.ifremer.fr), and collapsing that into the
    same result as "checked, genuinely nothing nearby" would silently misrepresent
    a network hiccup as a confirmed absence.
    """
    try:
        df = _load_argo_index()
    except Exception:
        return {"status": "lookup_failed"}

    mask = (
        (df["date"] >= pd.Timestamp.now() - pd.Timedelta(days=max_days)) &
        (df["latitude"] >= target_lat - max_distance_deg) & (df["latitude"] <= target_lat + max_distance_deg) &
        (df["longitude"] >= target_lon - max_distance_deg) & (df["longitude"] <= target_lon + max_distance_deg)
    )
    candidates = df[mask].copy()
    if len(candidates) == 0:
        return {"status": "none_nearby"}

    candidates["distance"] = np.sqrt(
        (candidates["latitude"] - target_lat) ** 2 + (candidates["longitude"] - target_lon) ** 2
    )
    candidates = candidates.sort_values("distance")

    any_fetch_succeeded = False
    for _, best in candidates.head(5).iterrows():
        try:
            file_url = f"https://data-argo.ifremer.fr/dac/{best['file']}"
            r = requests.get(file_url, timeout=20)
            r.raise_for_status()
            local_path = f"{LIVE_DIR}/recent_argo_temp.nc"
            with open(local_path, "wb") as f:
                f.write(r.content)
            any_fetch_succeeded = True

            argo = xr.open_dataset(local_path)
            pres = argo["PRES"].values[0]
            temp = argo["TEMP"].values[0]
            temp_qc = argo["TEMP_QC"].values[0]

            valid = ~np.isnan(pres) & ~np.isnan(temp)
            qc_str = [q.decode() if isinstance(q, bytes) else str(q) for q in temp_qc]
            good_qc = np.array([q in ("1", "2") for q in qc_str])
            keep = valid & good_qc
            if keep.sum() < 2:
                continue

            sort_idx = np.argsort(pres[keep])
            pres_sorted = pres[keep][sort_idx]
            temp_sorted = temp[keep][sort_idx]

            # Only trust this as a real surface reading if the shallowest
            # actual measurement is genuinely close to the surface
            if pres_sorted[0] > 15:
                continue

            surface_temp = float(np.interp(0, pres_sorted, temp_sorted))
            days_ago = (pd.Timestamp.now() - best["date"]).days

            return {
                "status": "found",
                "surface_temp_c": round(surface_temp, 2),
                "date": str(best["date"].date()),
                "days_ago": int(days_ago),
                "lat": round(float(best["latitude"]), 2),
                "lon": round(float(best["longitude"]), 2),
                "distance_km": round(float(best["distance"]) * 111, 0),
            }
        except Exception:
            continue

    # Real candidates existed by location/date, but every attempt to fetch or
    # read their actual profile file failed - genuinely different from having
    # read them and finding no usable near-surface reading.
    if not any_fetch_succeeded:
        return {"status": "lookup_failed"}
    return {"status": "none_nearby"}


# ---------- Core streaming prediction logic ----------

def _predict_stream_generator(lat, lon, region):
    """
    Yields a status message immediately AFTER each real fetch completes -
    this is what makes the frontend's progress checklist genuine rather
    than a fake animation. Ends by yielding the final result.
    """
    try:
        if region == "arabian":
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

            sst_val = float(xr.open_dataset(sst_path)["analysed_sst"].sel(latitude=lat, longitude=lon, method="nearest").isel(time=0))
            if sst_val > 100:
                sst_val -= 273.15
            ssh_val = float(xr.open_dataset(ssh_path)["sla"].sel(latitude=lat, longitude=lon, method="nearest").isel(time=0))
            sss_val = float(xr.open_dataset(sss_path)["sos"].squeeze(drop=True).sel(latitude=lat, longitude=lon, method="nearest"))
            mld_val = float(xr.open_dataset(mld_path)["mlotst"].sel(latitude=lat, longitude=lon, method="nearest").isel(time=0))
            curl_val = float(xr.open_dataset(curl_path)["stress_curl"].sel(latitude=lat, longitude=lon, method="nearest").isel(time=0))

            ssh_patch = xr.open_dataset(ssh_path)["sla"].isel(time=0)
            g, omega = 9.81, 7.2921e-5
            f = 2 * omega * np.sin(np.deg2rad(lat))
            lat_rad = np.deg2rad(ssh_patch.latitude)
            dx = 111320 * np.cos(lat_rad)
            dy = 110540
            d2_dx2 = ssh_patch.differentiate("longitude").differentiate("longitude") / (dx ** 2)
            d2_dy2 = ssh_patch.differentiate("latitude").differentiate("latitude") / (dy ** 2)
            vort_val = float(((g / f) * (d2_dx2 + d2_dy2)).sel(latitude=lat, longitude=lon, method="nearest"))

            cluster_id = _get_cluster_id(lat, lon, arabian_cluster_map, ar_grid_lats, ar_grid_lons)
            if cluster_id == -1:
                yield {"step": "error", "done": True, "error": "No valid grid data at this exact point"}
                return

            cluster_onehot = np.zeros(10)
            cluster_onehot[cluster_id] = 1
            x = np.concatenate([[sst_val, ssh_val, curl_val, mld_val, sss_val, vort_val], cluster_onehot]).reshape(1, -1).astype(np.float32)
            x_norm = (x - arabian_norm["X_mean"]) / arabian_norm["X_std"]
            x_t = torch.tensor(x_norm, dtype=torch.float32).to(device)
            with torch.no_grad():
                pred_norm = arabian_model(x_t).cpu().numpy()[0]
            pred_temp = pred_norm * arabian_norm["y_std"] + arabian_norm["y_mean"]
            pred_corrected = [round(float(pred_temp[i] - arabian_correction[d]), 2) for i, d in enumerate(depths)]

            surface_state = {
                "sst_c": round(sst_val, 2), "ssh_m": round(ssh_val, 3),
                "wind_stress_curl": curl_val, "mld_m": round(mld_val, 1),
                "sss_psu": round(sss_val, 2), "eddy_vorticity": vort_val,
            }
            data_dates = {"sst": str(sst_date), "ssh": str(ssh_date), "sss": str(sss_date), "mld": str(mld_date), "curl": str(curl_date)}
            region_name = "Arabian Sea"

        else:  # bay
            yield {"step": "Fetching live sea surface temperature...", "done": False}
            sst_path, sst_date = _fetch_latest("METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2", "analysed_sst", lat, lon, "live_sst_bay.nc")

            yield {"step": "Fetching live sea level data...", "done": False}
            ssh_path, ssh_date = _fetch_latest("cmems_obs-sl_glo_phy-ssh_nrt_allsat-l4-duacs-0.125deg_P1D", "sla", lat, lon, "live_ssh_bay.nc")

            sst_val = float(xr.open_dataset(sst_path)["analysed_sst"].sel(latitude=lat, longitude=lon, method="nearest").isel(time=0))
            if sst_val > 100:
                sst_val -= 273.15
            ssh_val = float(xr.open_dataset(ssh_path)["sla"].sel(latitude=lat, longitude=lon, method="nearest").isel(time=0))

            cluster_id = _get_cluster_id(lat, lon, bay_cluster_map, bay_grid_lats, bay_grid_lons)
            if cluster_id == -1:
                yield {"step": "error", "done": True, "error": "No valid grid data at this exact point"}
                return

            cluster_onehot = np.zeros(5)
            cluster_onehot[cluster_id] = 1
            x = np.concatenate([[sst_val, ssh_val], cluster_onehot]).reshape(1, -1).astype(np.float32)
            x_norm = (x - bay_norm["X_mean"]) / bay_norm["X_std"]
            x_t = torch.tensor(x_norm, dtype=torch.float32).to(device)
            with torch.no_grad():
                pred_norm = bay_model(x_t).cpu().numpy()[0]
            pred_temp = pred_norm * bay_norm["y_std"] + bay_norm["y_mean"]
            pred_corrected = [round(float(pred_temp[i] - bay_correction[d]), 2) for i, d in enumerate(depths)]

            surface_state = {"sst_c": round(sst_val, 2), "ssh_m": round(ssh_val, 3)}
            data_dates = {"sst": str(sst_date), "ssh": str(ssh_date)}
            region_name = "Bay of Bengal"

        # A land/masked cell (or an all-NaN fetch) makes every input and the
        # prediction NaN. That is "no data", never a valid result.
        bad_inputs = [k for k, v in surface_state.items() if not np.isfinite(v)]
        if bad_inputs or not all(np.isfinite(pred_corrected)):
            yield {"step": "error", "done": True,
                   "error": f"No valid live data at this exact point ({', '.join(bad_inputs) or 'prediction'} unavailable - e.g. a land or masked grid cell)"}
            return

        yield {"step": "Checking for nearby recent real Argo measurements...", "done": False}
        recent_argo = find_nearest_recent_argo(lat, lon)

        result = {
            "location": {"lat": lat, "lon": lon, "region": region_name},
            "mode": "live",
            "data_dates": data_dates,
            "surface_state": surface_state,
            "profile": {"depths_m": depths, "predicted_temp_c": pred_corrected},
            "recent_argo_context": recent_argo,
        }

        yield {"step": "complete", "done": True, "result": result}

    except Exception as e:
        yield {"step": "error", "done": True, "error": str(e)}


def predict_live_streaming(lat, lon):
    """Public streaming entry point - used by the FastAPI SSE endpoint."""
    region = _classify_region(lat, lon)
    if region is None:
        yield {"step": "error", "done": True, "error": "No coverage at this location"}
        return
    yield from _predict_stream_generator(lat, lon, region)


def predict_live(lat, lon):
    """Plain (non-streaming) version - runs the generator to completion and returns the final result."""
    region = _classify_region(lat, lon)
    if region is None:
        return None
    for update in _predict_stream_generator(lat, lon, region):
        if update.get("done"):
            return update.get("result")
    return None


# ---------- Normalized ocean-state endpoint (Intelligence page) ----------

CURRENT_DATASET_ID = "cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m"
WIND_DATASET_ID = "cmems_obs-wind_glo_phy_nrt_l4_0.125deg_PT1H"


def _surface_value(path, variable, lat, lon):
    """Reads one real value from a fetched file at the nearest real grid
    cell — drops a depth dimension down to its shallowest level first, if
    the product carries one (the current dataset does; SST/SSH don't)."""
    da = xr.open_dataset(path)[variable].isel(time=0)
    if "depth" in da.dims:
        da = da.isel(depth=0)
    value = float(da.sel(latitude=lat, longitude=lon, method="nearest"))
    if not np.isfinite(value):
        # A land/masked cell reads back as NaN - not a real value. Raising lets
        # every caller's existing "real fetch failed -> honest null" path run
        # instead of putting NaN (invalid JSON) into the response.
        raise ValueError(f"No valid {variable} value at this point")
    return value


def _current_direction_deg(u, v):
    """Standard compass bearing (0=N, clockwise) — matches
    lib/geodesicRoute.js's calculateInitialBearing() and the old (deleted)
    frontend providers' own direction math exactly, so Maritime's existing
    route-bearing display stays consistent with this."""
    bearing = float(np.degrees(np.arctan2(u, v)))
    return (bearing + 360) % 360


def get_ocean_state_streaming(lat, lon):
    """
    Streaming version of the /api/ocean-state pipeline — yields a status
    message immediately AFTER each real step completes, same pattern (and,
    for the shared subsurface/surface steps, the exact same step text) as
    _predict_stream_generator()/predict_live_streaming() already use for the
    Solution page's live mode. This is what lets the Intelligence page show
    the same kind of real, honest progress checklist instead of a single
    static "loading" label. Ends with the identical final response shape
    get_ocean_state() returns, as {"step": "complete", "done": True, "result": ...}.
    """
    region = _classify_region(lat, lon)

    response = {
        "location": {"lat": lat, "lon": lon},
        "surface": {
            "sst_c": None, "sss_psu": None, "current_u_ms": None, "current_v_ms": None, "ssh_m": None,
            "wind_u_ms": None, "wind_v_ms": None,
        },
        "subsurface": {"source": "OceanEmbed", "depth_m": depths, "temperature_c": None, "valid": False},
        "reference": {"source": None, "temperature_c_by_depth": None, "same_depth": False},
        "derived": {
            "current_speed_ms": None, "current_direction_deg": None,
            "vertical_gradient_c_per_m": None, "temperature_anomaly_c": None,
            "wind_speed_ms": None, "wind_direction_deg": None,
        },
        "provenance": [],
    }

    if region is None:
        # No real model coverage at all here — same honest empty response as
        # the non-streaming path, returned immediately rather than after a
        # real 5-90s fetch we already know can't be served.
        yield {"step": "complete", "done": True, "result": response}
        return

    provenance = set()
    temps = None

    # ---- Subsurface + base surface fields: reuse _predict_stream_generator()
    # directly (not predict_live()) so its real per-fetch step messages —
    # "Fetching live sea surface temperature...", etc. — get forwarded as-is.
    # A "done" update whose step is "error" means that fetch chain failed;
    # swallowed here (base stays None) rather than treated as fatal, exactly
    # like get_ocean_state()'s try/except already did — current/wind/
    # climatology below are independent and still worth attempting. ----
    base = None
    try:
        for update in _predict_stream_generator(lat, lon, region):
            if update.get("done"):
                if update.get("step") != "error":
                    base = update.get("result")
            else:
                yield update
    except Exception:
        base = None

    if base is not None:
        surface_state = base["surface_state"]
        response["surface"]["sst_c"] = surface_state.get("sst_c")
        response["surface"]["ssh_m"] = surface_state.get("ssh_m")
        if "sss_psu" in surface_state:  # Arabian Sea already fetches this as a real model input
            response["surface"]["sss_psu"] = surface_state["sss_psu"]
        temps = base["profile"]["predicted_temp_c"]
        response["subsurface"]["temperature_c"] = temps
        response["subsurface"]["valid"] = True
        provenance.add("OSTIA")
        provenance.add("OceanEmbed")

    # ---- Bay of Bengal SSS: not a model input there, but real, live page context ----
    if region == "bay" and response["surface"]["sss_psu"] is None:
        yield {"step": "Fetching live salinity data...", "done": False}
        try:
            sss_path, _ = _fetch_latest("cmems_obs-mob_glo_phy-sss_nrt_multi_P1D", "sos", lat, lon, "ocean_state_sss_bay.nc", start_days_back=6)
            response["surface"]["sss_psu"] = round(_surface_value(sss_path, "sos", lat, lon), 2)
            provenance.add("SMAP")
        except Exception:
            pass  # stays null — a real fetch failure, not fabricated

    # ---- Live current U/V: real page context, not a model input anywhere ----
    yield {"step": "Fetching live ocean current data...", "done": False}
    try:
        u_path, _ = _fetch_latest(CURRENT_DATASET_ID, "uo", lat, lon, "ocean_state_current_u.nc", min_depth=0, max_depth=1)
        v_path, _ = _fetch_latest(CURRENT_DATASET_ID, "vo", lat, lon, "ocean_state_current_v.nc", min_depth=0, max_depth=1)
        u_val = _surface_value(u_path, "uo", lat, lon)
        v_val = _surface_value(v_path, "vo", lat, lon)
        response["surface"]["current_u_ms"] = round(u_val, 3)
        response["surface"]["current_v_ms"] = round(v_val, 3)
        response["derived"]["current_speed_ms"] = round(float(np.hypot(u_val, v_val)), 3)
        response["derived"]["current_direction_deg"] = round(_current_direction_deg(u_val, v_val), 1)
        provenance.add("CMEMS Currents")
    except Exception:
        pass  

    yield {"step": "Fetching live wind data...", "done": False}
    try:
        wu_path, _ = _fetch_latest(WIND_DATASET_ID, "eastward_wind", lat, lon, "ocean_state_wind_u.nc", hourly=True)
        wv_path, _ = _fetch_latest(WIND_DATASET_ID, "northward_wind", lat, lon, "ocean_state_wind_v.nc", hourly=True)
        wu_val = _surface_value(wu_path, "eastward_wind", lat, lon)
        wv_val = _surface_value(wv_path, "northward_wind", lat, lon)
        response["surface"]["wind_u_ms"] = round(wu_val, 2)
        response["surface"]["wind_v_ms"] = round(wv_val, 2)
        response["derived"]["wind_speed_ms"] = round(float(np.hypot(wu_val, wv_val)), 2)
        response["derived"]["wind_direction_deg"] = round(_current_direction_deg(wu_val, wv_val), 1)
        provenance.add("CMEMS Wind")
    except Exception:
        pass  # wind stays null — a real fetch failure, not fabricated

    # ---- Vertical temperature gradient (only meaningful if subsurface is real) ----
    if temps is not None:
        response["derived"]["vertical_gradient_c_per_m"] = [
            round((temps[i + 1] - temps[i]) / (depths[i + 1] - depths[i]), 4)
            for i in range(len(depths) - 1)
        ]

    # ---- GLORYS climatology reference (Bay of Bengal only, and only within
    # the climatology file's own real coverage — narrower than the model's
    # full 5-30N Bay region, checked explicitly rather than assumed) ----
    if region == "bay" and _climatology_da is not None and lat <= CLIMATOLOGY_LAT_MAX:
        yield {"step": "Checking reference baseline...", "done": False}
        try:
            day_of_year = datetime.now(timezone.utc).timetuple().tm_yday
            ref_values = _climatology_da.sel(
                dayofyear=day_of_year, latitude=lat, longitude=lon, method="nearest"
            ).values  # one value per depth, already aligned 1:1 with `depths`
            ref_list = [None if np.isnan(v) else round(float(v), 2) for v in ref_values]

            if any(v is not None for v in ref_list):
                response["reference"]["source"] = "GLORYS climatology (Bay of Bengal only)"
                response["reference"]["temperature_c_by_depth"] = ref_list
                response["reference"]["same_depth"] = True
                provenance.add("GLORYS")

                if temps is not None:
                    response["derived"]["temperature_anomaly_c"] = [
                        None if ref_list[i] is None else round(temps[i] - ref_list[i], 2)
                        for i in range(len(depths))
                    ]
        except Exception:
            pass  # reference stays null — a real lookup failure, not fabricated

    response["provenance"] = sorted(provenance)
    yield {"step": "complete", "done": True, "result": response}


def get_ocean_state(lat, lon):
    """Plain (non-streaming) version — runs the generator to completion and
    returns the final result, same relationship predict_live() already has
    to predict_live_streaming()/_predict_stream_generator()."""
    for update in get_ocean_state_streaming(lat, lon):
        if update.get("done"):
            return update.get("result")


# ---------- Recent Validation Calendar (Solution page) ----------
#
# Everything here is additive: it does not touch predict_live()/_fetch_latest()
# or any existing endpoint. It answers "on this specific past date, which real
# Argo floats reported in this region, and how did our model's prediction for
# that float's exact location and day compare against what that float really
# measured?"
#
# Honest data-quality note (surfaced to the UI, never hidden): recent Argo
# profiles are typically REAL-TIME (R) mode - genuine float measurements,
# published within ~a day, but NOT the fully quality-controlled delayed-mode
# (D) data behind the site's official documented validation numbers. The real
# mode is read from each profile file's own name (R... vs D...), not assumed.

import re
import uuid
from datetime import date as _date

_FLOAT_ID_RE = re.compile(r"^[^/]+/([^/]+)/")
CALENDAR_REGIONS = {"bay_of_bengal": "bay", "arabian_sea": "arabian"}
NEAR_SURFACE_TOLERANCE_DBAR = 15  # same near-surface trust rule as find_nearest_recent_argo


def _parse_iso_date(value):
    try:
        return _date.fromisoformat(value)
    except (TypeError, ValueError):
        raise ValueError(f"Invalid date {value!r} - expected YYYY-MM-DD")


def _argo_region_mask(df, region_param):
    """Same real coverage bounds _classify_region() uses, applied to the index."""
    if region_param not in CALENDAR_REGIONS:
        raise ValueError(f"Unknown region {region_param!r} - expected bay_of_bengal or arabian_sea")
    lat_ok = (df["latitude"] >= LAT_MIN) & (df["latitude"] <= LAT_MAX)
    if CALENDAR_REGIONS[region_param] == "arabian":
        lon_ok = (df["longitude"] >= ARABIAN_LON_MIN) & (df["longitude"] < ARABIAN_LON_MAX)
    else:
        lon_ok = (df["longitude"] >= BAY_LON_MIN) & (df["longitude"] <= BAY_LON_MAX)
    return lat_ok & lon_ok


def _argo_data_mode(file_ref):
    """'real-time' (R) or 'delayed-mode' (D), read from the profile filename."""
    name = os.path.basename(str(file_ref))
    return "delayed-mode" if name[:1].upper() == "D" else "real-time"


def get_argo_dates_with_data(region_param, start_date, end_date):
    """Real dates in [start, end] with at least one real Argo profile in the region."""
    start, end = _parse_iso_date(start_date), _parse_iso_date(end_date)
    df = _load_argo_index()
    window = df[
        (df["date"] >= pd.Timestamp(start)) & (df["date"] < pd.Timestamp(end) + pd.Timedelta(days=1))
    ]
    window = window[_argo_region_mask(window, region_param)].dropna(subset=["date"])
    dates = sorted({d.isoformat() for d in window["date"].dt.date.unique()})
    return {"region": region_param, "start_date": str(start), "end_date": str(end), "dates": dates}


_profile_coverage_cache = {}


def _profile_coverage(file_ref):
    """How deep a real Argo profile genuinely reaches (good-QC readings only),
    judged against the model's 15 fixed depths. Cached per profile file - a
    profile never changes once published. None if the file can't be read now
    (unknown - never guessed)."""
    if file_ref in _profile_coverage_cache:
        return _profile_coverage_cache[file_ref]
    try:
        profile = _read_argo_profile(file_ref)
    except Exception:
        return None
    if profile is None:
        cov = {"min_dbar": None, "max_dbar": None, "n_overlap": 0, "depth_class": "unusable"}
    else:
        pres, temp = profile
        overlap = sum(1 for v in _argo_on_model_depths(pres, temp) if v is not None)
        cov = {
            "min_dbar": round(float(pres[0]), 1), "max_dbar": round(float(pres[-1]), 1),
            "n_overlap": overlap,
            # full: reaches ~700 dbar+; partial: comparable but limited; shallow: too few depths for metrics
            "depth_class": "full" if overlap >= 14 else ("partial" if overlap >= MIN_DEPTHS_FOR_METRICS else "shallow"),
        }
    _profile_coverage_cache[file_ref] = cov
    return cov


def get_argo_floats_by_date(target_date, region_param):
    """Every real Argo profile reported on exactly this date within the region."""
    day = _parse_iso_date(target_date)
    df = _load_argo_index()
    window = df[(df["date"] >= pd.Timestamp(day)) & (df["date"] < pd.Timestamp(day) + pd.Timedelta(days=1))]
    window = window[_argo_region_mask(window, region_param)].dropna(subset=["latitude", "longitude"])
    floats = []
    for _, row in window.sort_values("date").iterrows():
        m = _FLOAT_ID_RE.match(str(row["file"]))
        floats.append({
            "float_id": m.group(1) if m else str(row["file"]),
            "file": str(row["file"]),
            "lat": round(float(row["latitude"]), 3),
            "lon": round(float(row["longitude"]), 3),
            "time_utc": row["date"].strftime("%H:%M"),
            "data_mode": _argo_data_mode(row["file"]),
        })
    for f in floats:
        f["coverage"] = _profile_coverage_cache.get(f["file"])  # known only once looked up; never guessed
    return {"region": region_param, "date": str(day), "count": len(floats), "floats": floats}


def get_argo_profile_coverage(target_date, region_param):
    """Real depth coverage of every profile on this date, looked up in parallel
    (each needs its own small download, so this is kept separate from the
    instant floats list). Returns {file: coverage-or-None}."""
    from concurrent.futures import ThreadPoolExecutor
    floats = get_argo_floats_by_date(target_date, region_param)["floats"]
    with ThreadPoolExecutor(max_workers=16) as ex:
        covs = list(ex.map(lambda f: _profile_coverage(f["file"]), floats))
    return {"region": region_param, "date": target_date, "coverage": {f["file"]: c for f, c in zip(floats, covs)}}


def get_recent_argo_count(region_param, days=7):
    """Distinct real floats (not profile rows) that reported in the region in the last N days."""
    df = _load_argo_index()
    cutoff = pd.Timestamp.now() - pd.Timedelta(days=days)
    window = df[df["date"] >= cutoff]
    window = window[_argo_region_mask(window, region_param)]
    ids = {(_FLOAT_ID_RE.match(str(f)).group(1) if _FLOAT_ID_RE.match(str(f)) else str(f)) for f in window["file"]}
    return {"region": region_param, "window_days": days, "count": len(ids), "profiles": int(len(window))}


def _fetch_exact_date(dataset_id, variable, lat, lon, tag, target_date, hourly=False):
    """One real fetch for one exact past date - no retry-backward loop, since a
    date weeks or months old is already published. Unique filename +
    overwrite=True so a stale earlier file can never be read back by mistake
    (copernicusmarine otherwise silently renames on collision), and callers
    delete it after reading."""
    filename = f"cal_{tag}_{target_date}_{lat:.3f}_{lon:.3f}_{uuid.uuid4().hex[:6]}.nc"
    start = f"{target_date}T12:00:00" if hourly else str(target_date)
    copernicusmarine.subset(
        dataset_id=dataset_id, variables=[variable],
        minimum_longitude=lon - 0.5, maximum_longitude=lon + 0.5,
        minimum_latitude=lat - 0.5, maximum_latitude=lat + 0.5,
        start_datetime=start, end_datetime=start,
        output_directory=LIVE_DIR, output_filename=filename, overwrite=True,
    )
    return f"{LIVE_DIR}/{filename}"


def _load_and_discard(path, variable):
    """Read one variable fully into memory, then close and delete the file."""
    ds = xr.open_dataset(path)
    try:
        return ds[variable].load()
    finally:
        ds.close()
        try:
            os.remove(path)
        except OSError:
            pass


def _read_argo_profile(file_ref):
    """Download and parse one real Argo profile: (pres, temp) of good-QC readings only."""
    local_path = f"{LIVE_DIR}/cal_argo_{uuid.uuid4().hex[:8]}.nc"
    r = requests.get(f"https://data-argo.ifremer.fr/dac/{file_ref}", timeout=30)
    r.raise_for_status()
    with open(local_path, "wb") as f:
        f.write(r.content)
    argo = xr.open_dataset(local_path)
    try:
        pres = argo["PRES"].values[0]
        temp = argo["TEMP"].values[0]
        temp_qc = argo["TEMP_QC"].values[0]
    finally:
        argo.close()
        try:
            os.remove(local_path)
        except OSError:
            pass

    qc_str = [q.decode() if isinstance(q, bytes) else str(q) for q in temp_qc]
    good_qc = np.array([q in ("1", "2") for q in qc_str])
    keep = ~np.isnan(pres) & ~np.isnan(temp) & good_qc
    if keep.sum() < 2:
        return None
    order = np.argsort(pres[keep])
    return pres[keep][order], temp[keep][order]


def _argo_on_model_depths(pres, temp):
    """Real Argo readings interpolated onto the model's 15 fixed depths - but
    only where the float genuinely measured. Beyond its real shallowest/
    deepest reading (plus the same 15 dbar near-surface trust tolerance used
    elsewhere) the value is None, never extrapolated."""
    out = []
    for d in depths:
        if pres[0] - NEAR_SURFACE_TOLERANCE_DBAR <= d <= pres[-1] + NEAR_SURFACE_TOLERANCE_DBAR:
            out.append(round(float(np.interp(d, pres, temp)), 2))
        else:
            out.append(None)
    return out


MIN_DEPTHS_FOR_METRICS = 8  # a float that only reached ~100 dbar can't support a meaningful summary


def _comparison_metrics(predicted, argo):
    """RMSE/bias/correlation over the depths the float genuinely measured. With
    fewer than MIN_DEPTHS_FOR_METRICS overlapping depths a summary number would
    be misleading (one deep point can give a near-zero "RMSE"), so none is given."""
    pairs = [(p, a) for p, a in zip(predicted, argo) if a is not None and p is not None]
    if len(pairs) < MIN_DEPTHS_FOR_METRICS:
        return None
    p = np.array([x[0] for x in pairs]); a = np.array([x[1] for x in pairs])
    corr = None
    if len(pairs) >= 3 and np.std(p) > 0 and np.std(a) > 0:
        corr = round(float(np.corrcoef(p, a)[0, 1]), 3)
    return {
        "rmse_c": round(float(np.sqrt(np.mean((p - a) ** 2))), 3),
        "bias_c": round(float(np.mean(p - a)), 3),
        "correlation": corr,
        "n_depths": len(pairs),
    }


def _model_profile_for_date(lat, lon, region, target_date):
    """Runs the correct trained model on real surface data for one exact past
    date at one exact location. A generator so the caller can forward real
    per-fetch progress; its final yield is ("result", (surface_state,
    data_dates, predicted_profile))."""
    d = str(target_date)
    if region == "arabian":
        yield ("step", f"Fetching real sea surface temperature for {d}...")
        sst = _load_and_discard(_fetch_exact_date("METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2", "analysed_sst", lat, lon, "sst", d), "analysed_sst")
        yield ("step", f"Fetching real sea level data for {d}...")
        ssh = _load_and_discard(_fetch_exact_date("cmems_obs-sl_glo_phy-ssh_nrt_allsat-l4-duacs-0.125deg_P1D", "sla", lat, lon, "ssh", d), "sla")
        yield ("step", f"Fetching real salinity data for {d}...")
        sss = _load_and_discard(_fetch_exact_date("cmems_obs-mob_glo_phy-sss_nrt_multi_P1D", "sos", lat, lon, "sss", d), "sos")
        yield ("step", f"Fetching real mixed layer depth for {d}...")
        mld = _load_and_discard(_fetch_exact_date("cmems_mod_glo_phy_anfc_0.083deg_P1D-m", "mlotst", lat, lon, "mld", d), "mlotst")
        yield ("step", f"Fetching real wind data for {d}...")
        curl = _load_and_discard(_fetch_exact_date("cmems_obs-wind_glo_phy_nrt_l4_0.125deg_PT1H", "stress_curl", lat, lon, "curl", d, hourly=True), "stress_curl")

        sst_val = float(sst.isel(time=0).sel(latitude=lat, longitude=lon, method="nearest"))
        if sst_val > 100:
            sst_val -= 273.15
        ssh_patch = ssh.isel(time=0)
        ssh_val = float(ssh_patch.sel(latitude=lat, longitude=lon, method="nearest"))
        sss_val = float(sss.squeeze(drop=True).sel(latitude=lat, longitude=lon, method="nearest"))
        mld_val = float(mld.isel(time=0).sel(latitude=lat, longitude=lon, method="nearest"))
        curl_val = float(curl.isel(time=0).sel(latitude=lat, longitude=lon, method="nearest"))

        g, omega = 9.81, 7.2921e-5
        f = 2 * omega * np.sin(np.deg2rad(lat))
        dx = 111320 * np.cos(np.deg2rad(ssh_patch.latitude))
        dy = 110540
        d2_dx2 = ssh_patch.differentiate("longitude").differentiate("longitude") / (dx ** 2)
        d2_dy2 = ssh_patch.differentiate("latitude").differentiate("latitude") / (dy ** 2)
        vort_val = float(((g / f) * (d2_dx2 + d2_dy2)).sel(latitude=lat, longitude=lon, method="nearest"))

        cluster_id = _get_cluster_id(lat, lon, arabian_cluster_map, ar_grid_lats, ar_grid_lons)
        if cluster_id == -1:
            raise RuntimeError("No valid model grid data at this exact point")
        onehot = np.zeros(10); onehot[cluster_id] = 1
        x = np.concatenate([[sst_val, ssh_val, curl_val, mld_val, sss_val, vort_val], onehot]).reshape(1, -1).astype(np.float32)
        norm, model, correction = arabian_norm, arabian_model, arabian_correction
        surface_state = {
            "sst_c": round(sst_val, 2), "ssh_m": round(ssh_val, 3), "wind_stress_curl": curl_val,
            "mld_m": round(mld_val, 1), "sss_psu": round(sss_val, 2), "eddy_vorticity": vort_val,
        }
        data_dates = {k: d for k in ("sst", "ssh", "sss", "mld", "curl")}
    else:
        yield ("step", f"Fetching real sea surface temperature for {d}...")
        sst = _load_and_discard(_fetch_exact_date("METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2", "analysed_sst", lat, lon, "sst", d), "analysed_sst")
        yield ("step", f"Fetching real sea level data for {d}...")
        ssh = _load_and_discard(_fetch_exact_date("cmems_obs-sl_glo_phy-ssh_nrt_allsat-l4-duacs-0.125deg_P1D", "sla", lat, lon, "ssh", d), "sla")
        sst_val = float(sst.isel(time=0).sel(latitude=lat, longitude=lon, method="nearest"))
        if sst_val > 100:
            sst_val -= 273.15
        ssh_val = float(ssh.isel(time=0).sel(latitude=lat, longitude=lon, method="nearest"))

        cluster_id = _get_cluster_id(lat, lon, bay_cluster_map, bay_grid_lats, bay_grid_lons)
        if cluster_id == -1:
            raise RuntimeError("No valid model grid data at this exact point")
        onehot = np.zeros(5); onehot[cluster_id] = 1
        x = np.concatenate([[sst_val, ssh_val], onehot]).reshape(1, -1).astype(np.float32)
        norm, model, correction = bay_norm, bay_model, bay_correction
        surface_state = {"sst_c": round(sst_val, 2), "ssh_m": round(ssh_val, 3)}
        data_dates = {k: d for k in ("sst", "ssh")}

    yield ("step", "Running the trained OceanEmbed model...")
    x_t = torch.tensor((x - norm["X_mean"]) / norm["X_std"], dtype=torch.float32).to(device)
    with torch.no_grad():
        pred_norm = model(x_t).cpu().numpy()[0]
    pred = pred_norm * norm["y_std"] + norm["y_mean"]
    predicted = [round(float(pred[i] - correction[dp]), 2) for i, dp in enumerate(depths)]
    yield ("result", (surface_state, data_dates, predicted))


def argo_date_comparison_streaming(lat, lon, target_date):
    """Real predicted-vs-real-Argo comparison for one float on one exact date,
    streamed with the same {"step","done"} shape as the app's other live
    endpoints. Every failure is a specific, honest error - never a fabricated
    fallback value."""
    try:
        day = _parse_iso_date(target_date)
        region = _classify_region(lat, lon)
        if region is None:
            yield {"step": "error", "done": True, "error": "This float is outside the model's real coverage - no prediction can be made here."}
            return

        yield {"step": "Locating the real Argo float profile...", "done": False}
        df = _load_argo_index()
        window = df[(df["date"] >= pd.Timestamp(day)) & (df["date"] < pd.Timestamp(day) + pd.Timedelta(days=1))]
        window = window[((window["latitude"] - lat).abs() < 0.005) & ((window["longitude"] - lon).abs() < 0.005)]
        if len(window) == 0:
            yield {"step": "error", "done": True, "error": "No Argo profile at these coordinates on this date was found in the real Argo index."}
            return
        row = window.iloc[0]
        file_ref = str(row["file"])

        yield {"step": "Downloading the real Argo profile...", "done": False}
        profile = _read_argo_profile(file_ref)
        if profile is None:
            yield {"step": "error", "done": True, "error": "This Argo profile has no usable quality-flagged temperature readings."}
            return
        argo_on_depths = _argo_on_model_depths(*profile)
        if all(v is None for v in argo_on_depths):
            yield {"step": "error", "done": True, "error": "This Argo profile does not overlap the model's depth range."}
            return

        surface_state = data_dates = predicted = None
        for kind, payload in _model_profile_for_date(lat, lon, region, day):
            if kind == "step":
                yield {"step": payload, "done": False}
            else:
                surface_state, data_dates, predicted = payload

        m = _FLOAT_ID_RE.match(file_ref)
        yield {"step": "complete", "done": True, "result": {
            "location": {"lat": lat, "lon": lon, "region": "Arabian Sea" if region == "arabian" else "Bay of Bengal"},
            "date": str(day),
            "float": {
                "float_id": m.group(1) if m else file_ref, "file": file_ref,
                "lat": round(float(row["latitude"]), 3), "lon": round(float(row["longitude"]), 3),
                "time_utc": row["date"].strftime("%H:%M"), "data_mode": _argo_data_mode(file_ref),
            },
            "data_dates": data_dates,
            "surface_state": surface_state,
            "profile": {"depths_m": depths, "predicted_temp_c": predicted, "argo_temp_c": argo_on_depths},
            "metrics": _comparison_metrics(predicted, argo_on_depths),
            "argo_measured_range_dbar": [round(float(profile[0][0]), 1), round(float(profile[0][-1]), 1)],
            "n_depths_overlap": sum(1 for v in argo_on_depths if v is not None),
        }}
    except ValueError as e:
        yield {"step": "error", "done": True, "error": str(e)}
    except Exception as e:
        # Most commonly: a source dataset has not published this exact date yet
        # (the salinity product lags ~a week), or a network failure.
        m_sel = re.search(r"selection \[(\d{4}-\d{2}-\d{2})", str(e))
        m_rng = re.search(r"dataset coordinates \[(\d{4}-\d{2}-\d{2})[^,]*, (\d{4}-\d{2}-\d{2})", str(e))
        if m_sel and m_rng and m_sel.group(1) < m_rng.group(1):
            yield {"step": "error", "done": True, "error": (
                f"The satellite data this model needs only starts on {m_rng.group(1)}, so a date this early "
                "can't be predicted from real inputs. The float's real position on this date is still shown.")}
            return
        if m_rng:
            yield {"step": "error", "done": True, "error": (
                f"The satellite data this model needs is only published up to {m_rng.group(2)} "
                "(the salinity product lags about a week), so this date can't be compared yet. "
                "Try an earlier date - Bay of Bengal floats need only SST and sea-level data and work up to the latest days.")}
            return
        yield {"step": "error", "done": True, "error": f"Could not build this comparison from real data: {e}"}


def get_argo_date_comparison(lat, lon, target_date):
    """Plain version - runs the generator to completion."""
    last = None
    for update in argo_date_comparison_streaming(lat, lon, target_date):
        last = update
    if last and last.get("step") == "complete":
        return last["result"]
    return {"error": (last or {}).get("error", "Comparison failed.")}


# ---------- Real Argo float drift track ----------
_FLOAT_ID_QUERY_RE = re.compile(r"^\d{4,8}$")
_CYCLE_RE = re.compile(r"_(\d+)\.nc$")
_float_suggestion_cache = {}


def get_argo_float_track(float_id, months=12):
    """Every real profile one Argo float reported, straight from the real Argo
    global profile index: one stop per real report, each with its own real date,
    time and coordinates. Nothing is interpolated - a stop only exists where the
    float really surfaced and reported. Covers the last `months` months of the
    float's own record (ending at its latest real profile).

    Rows with no recorded position in the index are dropped, and counted, rather
    than guessed."""
    float_id = str(float_id or "").strip()
    if not _FLOAT_ID_QUERY_RE.match(float_id):
        raise ValueError("A float ID is 4-8 digits, for example 2903831.")
    months = int(months)
    if months < 1 or months > 60:
        raise ValueError("months must be between 1 and 60")

    df = _load_argo_index()
    rows = df[df["file"].str.contains(f"/{float_id}/", regex=False)]
    # "/<id>/" could in principle match a different path component - keep only
    # rows whose float-ID path component really is this ID.
    rows = rows[rows["file"].map(lambda f: (_FLOAT_ID_RE.match(str(f)) or [None, None])[1] == float_id)]
    if len(rows) == 0:
        return {"error": f"No Argo float with ID {float_id} was found in the real Argo index."}

    total_profiles = int(len(rows))
    missing_position = int((rows["latitude"].isna() | rows["longitude"].isna()).sum())
    rows = rows.dropna(subset=["latitude", "longitude", "date"]).sort_values("date")
    if len(rows) == 0:
        return {"error": f"Float {float_id} has profiles in the index but none with a recorded position."}

    last_date = rows["date"].max()
    window_start = last_date - pd.DateOffset(months=months)
    win = rows[rows["date"] >= window_start]

    stops = []
    for _, r in win.iterrows():
        lat, lon = round(float(r["latitude"]), 3), round(float(r["longitude"]), 3)
        cyc = _CYCLE_RE.search(str(r["file"]))
        region = _classify_region(lat, lon)
        stops.append({
            "date": r["date"].strftime("%Y-%m-%d"),
            "time_utc": r["date"].strftime("%H:%M"),
            "lat": lat, "lon": lon,
            "file": str(r["file"]),
            "cycle": int(cyc.group(1)) if cyc else None,
            "data_mode": _argo_data_mode(r["file"]),
            "region": {"arabian": "Arabian Sea", "bay": "Bay of Bengal"}.get(region),
        })
    lats = [s["lat"] for s in stops]
    lons = [s["lon"] for s in stops]
    return {
        "float_id": float_id,
        "months": months,
        "window": {"first": stops[0]["date"], "last": stops[-1]["date"]},
        "n_stops": len(stops),
        "total_profiles_in_index": total_profiles,
        "profiles_without_position": missing_position,
        "record": {"first": rows["date"].min().strftime("%Y-%m-%d"), "last": last_date.strftime("%Y-%m-%d")},
        "extent": {"lat": [min(lats), max(lats)], "lon": [min(lons), max(lons)]},
        "stops": stops,
    }


def get_argo_float_suggestions(region_param="both", days=300, limit=6):
    """Real floats worth tracking: many real reports in the last `days` days,
    every report inside a model's real coverage, ranked by how far they really
    drifted. Cached for an hour."""
    key = (region_param, days, limit)
    hit = _float_suggestion_cache.get(key)
    if hit and (time.time() - hit[0]) < 3600:
        return hit[1]
    df = _load_argo_index()
    recent = df[df["date"] >= (df["date"].max() - pd.Timedelta(days=days))].dropna(subset=["latitude", "longitude"])
    if region_param in CALENDAR_REGIONS:
        recent = recent[_argo_region_mask(recent, region_param)]
    elif region_param == "both":
        recent = recent[_argo_region_mask(recent, "bay_of_bengal") | _argo_region_mask(recent, "arabian_sea")]
    else:
        raise ValueError("region must be bay_of_bengal, arabian_sea or both")
    recent = recent.assign(fid=recent["file"].str.split("/").str[1])
    g = recent.groupby("fid").agg(n=("file", "size"), lat0=("latitude", "min"), lat1=("latitude", "max"),
                                  lon0=("longitude", "min"), lon1=("longitude", "max"),
                                  first=("date", "min"), last=("date", "max"))
    g = g[g["n"] >= 15]
    g["span_deg"] = np.hypot(g["lat1"] - g["lat0"], g["lon1"] - g["lon0"])
    out = []
    for fid, r in g.sort_values("span_deg", ascending=False).head(limit).iterrows():
        mid = (r["lat0"] + r["lat1"]) / 2, (r["lon0"] + r["lon1"]) / 2
        out.append({
            "float_id": fid, "n_profiles": int(r["n"]), "drift_span_deg": round(float(r["span_deg"]), 1),
            "first": r["first"].strftime("%Y-%m-%d"), "last": r["last"].strftime("%Y-%m-%d"),
            "region": {"arabian": "Arabian Sea", "bay": "Bay of Bengal"}.get(_classify_region(*mid)),
        })
    result = {"region": region_param, "days": days, "floats": out}
    _float_suggestion_cache[key] = (time.time(), result)
    return result


if __name__ == "__main__":
    import json
    print("Testing live prediction - Bay of Bengal point...")
    print(json.dumps(predict_live(15.0, 88.0), indent=2))

    print("\nTesting live prediction - Arabian Sea point...")
    print(json.dumps(predict_live(17.0, 58.0), indent=2))