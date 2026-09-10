"""
Download full-region HYCOM GLBy0.08 surface currents via OPeNDAP.
Uses same access method as validated fetch_hycom.py.
Region: 40-115°E, -35-30°N
"""
import xarray as xr
import numpy as np
import json
import os
import math
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NC_FILE   = os.path.join(ROOT, "hycom_currents_full.nc")
BIN_FILE  = os.path.join(ROOT, "ocean-hero-app", "public", "data", "currents", "hycom_latest.bin")
META_FILE = os.path.join(ROOT, "ocean-hero-app", "public", "data", "currents", "hycom_latest.meta.json")
os.makedirs(os.path.dirname(BIN_FILE), exist_ok=True)

NORTH  =  30.0
SOUTH  = -35.0
WEST   =  40.0
EAST   = 115.0

OPeNDAP = "https://tds.hycom.org/thredds/dodsC/GLBy0.08/latest"

print(f"Connecting to OPeNDAP: {OPeNDAP}")
ds = xr.open_dataset(OPeNDAP, decode_times=False)

# ── Coordinate names ──────────────────────────────────────────────────────────
lat_name   = next(c for c in ds.coords if 'lat' in c.lower())
lon_name   = next(c for c in ds.coords if 'lon' in c.lower())
time_name  = next((c for c in ds.coords if 'time' in c.lower()), None)
depth_name = next((c for c in ds.coords if 'depth' in c.lower()), None)

t_units = ds[time_name].attrs.get('units', 'Unknown') if time_name else 'Unknown'
print(f"Time units: {t_units}")
print(f"Time values (first 3): {ds[time_name].values[:3] if time_name else 'n/a'}")
print(f"Depth values (first 5): {ds[depth_name].values[:5] if depth_name else 'n/a'}")

def latest_analysis_index(data_array):
    time_coord = data_array.dims[0]
    run_coord = f"{time_coord}_run"
    times = np.asarray(ds[time_coord].values, dtype=float)
    runs = np.asarray(ds[run_coord].values, dtype=float)
    latest_run = np.nanmax(runs)
    candidates = np.flatnonzero((runs == latest_run) & np.isclose(times, runs))
    if candidates.size == 0:
        raise RuntimeError(f"No analysis timestamp found for {time_coord}")
    return int(candidates[-1]), float(times[candidates[-1]]), ds[time_coord].attrs.get('units', 'Unknown')

u_time_idx, u_time_raw, u_time_units = latest_analysis_index(ds['water_u'])
v_time_idx, v_time_raw, v_time_units = latest_analysis_index(ds['water_v'])
if not np.isclose(u_time_raw, v_time_raw) or u_time_units != v_time_units:
    raise RuntimeError("water_u and water_v do not share the same analysis timestamp")

u_surface = ds['water_u'].isel({ds['water_u'].dims[0]: u_time_idx, depth_name: 0})
v_surface = ds['water_v'].isel({ds['water_v'].dims[0]: v_time_idx, depth_name: 0})

print(f"\nSubsetting to {WEST}–{EAST}°E, {SOUTH}–{NORTH}°N ...")
u_region = u_surface.sel({
    lat_name: slice(SOUTH, NORTH),
    lon_name: slice(WEST, EAST)
})
v_region = v_surface.sel({
    lat_name: slice(SOUTH, NORTH),
    lon_name: slice(WEST, EAST)
})

lats = u_region[lat_name].values
lons = u_region[lon_name].values
print(f"Grid: {lats.shape[0]} lats × {lons.shape[0]} lons")
print(f"Lat range: {float(lats.min()):.3f} to {float(lats.max()):.3f}")
print(f"Lon range: {float(lons.min()):.3f} to {float(lons.max()):.3f}")

u_2d = u_region.values.squeeze().astype(np.float32)  # (lat, lon)
v_2d = v_region.values.squeeze().astype(np.float32)

# Replace fill values with NaN
for arr, variable in [(u_2d, 'water_u'), (v_2d, 'water_v')]:
    fill = ds[variable].attrs.get('_FillValue', ds[variable].attrs.get('missing_value'))
    if fill is not None:
        arr[arr == float(fill)] = np.nan
    arr[~np.isfinite(arr)] = np.nan

invalid = ~np.isfinite(u_2d) | ~np.isfinite(v_2d)
u_2d[invalid] = np.nan
v_2d[invalid] = np.nan

n_lat, n_lon = u_2d.shape
speed = np.sqrt(u_2d**2 + v_2d**2)
valid = int(np.sum(~invalid))
missing = int(np.sum(invalid))

print(f"\nU min/max/mean: {np.nanmin(u_2d):.3f} / {np.nanmax(u_2d):.3f} / {np.nanmean(u_2d):.3f} m/s")
print(f"V min/max/mean: {np.nanmin(v_2d):.3f} / {np.nanmax(v_2d):.3f} / {np.nanmean(v_2d):.3f} m/s")
print(f"Speed min/max/mean: {np.nanmin(speed):.3f} / {np.nanmax(speed):.3f} / {np.nanmean(speed):.3f} m/s")
print(f"Valid: {valid}   Missing: {missing}")

def decode_timestamp(raw, units):
    if 'hours since' not in units:
        raise RuntimeError(f"Unsupported HYCOM time units: {units}")
    ref_text = units.split('hours since ', 1)[1].replace(' UTC', '').strip()
    ref = datetime.fromisoformat(ref_text).replace(tzinfo=timezone.utc)
    return (ref + timedelta(hours=raw)).strftime('%Y-%m-%dT%H:%M:%SZ')

actual_ts = decode_timestamp(u_time_raw, u_time_units)

print(f"Timestamp: {actual_ts}")

# ── Resolution ────────────────────────────────────────────────────────────────
lat_res = float(abs(lats[1] - lats[0])) if n_lat > 1 else 0.08
lon_res = float(abs(lons[1] - lons[0])) if n_lon > 1 else 0.08

# ── Save binary [U, V, U, V, ...] Float32 — same layout as existing provider ─
interleaved = np.stack([u_2d, v_2d], axis=-1).astype(np.float32)
interleaved.tofile(BIN_FILE)
bin_size = os.path.getsize(BIN_FILE)
print(f"\nBinary saved: {BIN_FILE}  ({bin_size:,} bytes = {bin_size/1024/1024:.1f} MB)")

# ── Metadata JSON ─────────────────────────────────────────────────────────────
meta = {
    "source": "HYCOM GLBy0.08 / latest",
    "product": "HYCOM ESPC-D-V02 Global 1/12° Analysis",
    "timestamp": actual_ts,
    "date": actual_ts,
    "surface_depth": 0.0,
    "u_var": "water_u",
    "v_var": "water_v",
    "units": "m/s",
    "latMin": float(lats.min()),
    "latMax": float(lats.max()),
    "lonMin": float(lons.min()),
    "lonMax": float(lons.max()),
    "latCount": int(n_lat),
    "lonCount": int(n_lon),
    "resolution_lat": round(lat_res, 8),
    "resolution_lon": round(lon_res, 8),
    "dimensions": {"lat": int(n_lat), "lon": int(n_lon), "depth": 1, "time": 1},
    "missing_value_representation": "NaN",
    "layout": "row_major_lat_lon_interleaved_U_V_float32",
    "metrics": {
        "u_min": float(np.nanmin(u_2d)),
        "u_max": float(np.nanmax(u_2d)),
        "u_mean": float(np.nanmean(u_2d)),
        "v_min": float(np.nanmin(v_2d)),
        "v_max": float(np.nanmax(v_2d)),
        "v_mean": float(np.nanmean(v_2d)),
        "speed_min": float(np.nanmin(speed)),
        "speed_max": float(np.nanmax(speed)),
        "speed_mean": float(np.nanmean(speed)),
        "valid_cells": valid,
        "missing_cells": missing
    },
    "binaryFile": "/data/currents/hycom_latest.bin",
    "binarySize": bin_size
}
with open(META_FILE, 'w') as f:
    json.dump(meta, f, indent=2)
print(f"Metadata saved: {META_FILE}")

# ── Point validations ─────────────────────────────────────────────────────────
def lookup(lat_q, lon_q):
    frontend_lats = np.linspace(float(lats.min()), float(lats.max()), n_lat)
    frontend_lons = np.linspace(float(lons.min()), float(lons.max()), n_lon)
    li  = int(np.argmin(np.abs(frontend_lats - lat_q)))
    loi = int(np.argmin(np.abs(frontend_lons - lon_q)))
    u = float(u_2d[li, loi])
    v = float(v_2d[li, loi])
    if not np.isfinite(u) or not np.isfinite(v):
        return "LAND/NO DATA"
    spd  = math.sqrt(u**2 + v**2)
    dirn = (math.atan2(u, v) * 180 / math.pi + 360) % 360
    return f"U={u:.3f}  V={v:.3f}  Speed={spd:.3f}  Dir={dirn:.0f}°  VALID"

print("\n── Point validation ──")
validation_report = {}
for lat_q, lon_q in [(15.0, 65.0), (15.0, 90.0), (-10.0, 80.0)]:
    frontend_lats = np.linspace(float(lats.min()), float(lats.max()), n_lat)
    frontend_lons = np.linspace(float(lons.min()), float(lons.max()), n_lon)
    li = int(np.argmin(np.abs(frontend_lats - lat_q)))
    loi = int(np.argmin(np.abs(frontend_lons - lon_q)))
    u = float(u_2d[li, loi])
    v = float(v_2d[li, loi])
    valid_point = bool(np.isfinite(u) and np.isfinite(v))
    validation_report[f"{lat_q}_{lon_q}"] = {
        "latitude": lat_q,
        "longitude": lon_q,
        "u": u if valid_point else None,
        "v": v if valid_point else None,
        "speed": math.sqrt(u**2 + v**2) if valid_point else None,
        "direction": (math.atan2(u, v) * 180 / math.pi + 360) % 360 if valid_point else None,
        "valid": valid_point,
        "status": "VALID" if valid_point else "GENUINELY_UNAVAILABLE"
    }
    print(f"  ({lat_q:+.1f}°, {lon_q:.1f}°E): {lookup(lat_q, lon_q)}")

with open(os.path.join(ROOT, "currents_validation.json"), 'w') as f:
    json.dump(validation_report, f, indent=2)

print("\nDONE.")
