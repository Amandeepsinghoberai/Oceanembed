import copernicusmarine
import xarray as xr
import numpy as np
import torch
import torch.nn as nn
import pandas as pd
import requests
import os
import time
from datetime import datetime, timedelta, timezone

depths = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
BAY_LON_MIN = 77.0
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
    if ARABIAN_LON_MIN <= lon < BAY_LON_MIN:
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
_ar_grid = xr.open_dataarray("models/processed_sst_full.nc").sel(longitude=slice(None, BAY_LON_MIN))
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


def _fetch_latest(dataset_id, variable, lat, lon, filename, max_days_back=14, hourly=False,
                   min_depth=None, max_depth=None):
    """Tries progressively older dates until the live dataset actually has data.

    min_depth/max_depth are optional and only needed for a genuinely 3D
    product (e.g. the current U/V dataset, which carries multiple depth
    levels) — omitted entirely for every existing 2D/surface-only caller,
    so their behavior is unchanged.
    """
    today = datetime.now(timezone.utc).date()
    out_path = f"{LIVE_DIR}/{filename}"

    for days_back in range(2, max_days_back + 1):
        target_date = today - timedelta(days=days_back)
        start = f"{target_date}T12:00:00" if hourly else str(target_date)
        end = start
        try:
            kwargs = dict(
                dataset_id=dataset_id, variables=[variable],
                minimum_longitude=lon - 0.5, maximum_longitude=lon + 0.5,
                minimum_latitude=lat - 0.5, maximum_latitude=lat + 0.5,
                start_datetime=start, end_datetime=end,
                output_directory=LIVE_DIR, output_filename=filename,
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

def _load_argo_index():
    global _argo_index_cache
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


def _surface_value(path, variable, lat, lon):
    """Reads one real value from a fetched file at the nearest real grid
    cell — drops a depth dimension down to its shallowest level first, if
    the product carries one (the current dataset does; SST/SSH don't)."""
    da = xr.open_dataset(path)[variable].isel(time=0)
    if "depth" in da.dims:
        da = da.isel(depth=0)
    return float(da.sel(latitude=lat, longitude=lon, method="nearest"))


def _current_direction_deg(u, v):
    """Standard compass bearing (0=N, clockwise) — matches
    lib/geodesicRoute.js's calculateInitialBearing() and the old (deleted)
    frontend providers' own direction math exactly, so Maritime's existing
    route-bearing display stays consistent with this."""
    bearing = float(np.degrees(np.arctan2(u, v)))
    return (bearing + 360) % 360


def get_ocean_state(lat, lon):
    """
    Powers GET /api/ocean-state — the one normalized response all 4
    Intelligence modules consume (OceanEmbed_Intelligence_Data_Requirements.txt,
    section 11). Reuses predict_live()'s region classification and subsurface
    pipeline rather than duplicating it; adds live current U/V (not a model
    input anywhere — real page context only), Bay-of-Bengal SSS as page
    context, and the GLORYS climatology reference/anomaly wherever that file
    actually covers. Every field is either a real fetched/computed value or
    an honest null — never a fabricated number.
    """
    region = _classify_region(lat, lon)

    response = {
        "location": {"lat": lat, "lon": lon},
        "surface": {"sst_c": None, "sss_psu": None, "current_u_ms": None, "current_v_ms": None, "ssh_m": None},
        "subsurface": {"source": "OceanEmbed", "depth_m": depths, "temperature_c": None, "valid": False},
        "reference": {"source": None, "temperature_c_by_depth": None, "same_depth": False},
        "derived": {
            "current_speed_ms": None, "current_direction_deg": None,
            "vertical_gradient_c_per_m": None, "temperature_anomaly_c": None,
        },
        "provenance": [],
    }

    if region is None:
        # No real model coverage at all here — fail fast and honestly rather
        # than spending a real 5-90s fetch on a point we already know we
        # can't serve (matches _classify_region's use everywhere else in
        # this file as the single gate on real coverage).
        return response

    provenance = set()
    temps = None

    # ---- Subsurface + base surface fields: reuse predict_live() exactly, no duplicated fetch/model logic ----
    try:
        base = predict_live(lat, lon)
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
        try:
            sss_path, _ = _fetch_latest("cmems_obs-mob_glo_phy-sss_nrt_multi_P1D", "sos", lat, lon, "ocean_state_sss_bay.nc")
            response["surface"]["sss_psu"] = round(_surface_value(sss_path, "sos", lat, lon), 2)
            provenance.add("SMAP")
        except Exception:
            pass  # stays null — a real fetch failure, not fabricated

    # ---- Live current U/V: real page context, not a model input anywhere ----
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
        pass  # current stays null — a real fetch failure, not fabricated

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
    return response


if __name__ == "__main__":
    import json
    print("Testing live prediction - Bay of Bengal point...")
    print(json.dumps(predict_live(15.0, 88.0), indent=2))

    print("\nTesting live prediction - Arabian Sea point...")
    print(json.dumps(predict_live(17.0, 58.0), indent=2))