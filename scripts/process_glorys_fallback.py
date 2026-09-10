"""Process the latest regional GLORYS surface subset into static frontend assets."""
import json
import math
import os
from datetime import datetime, timezone

import numpy as np
import xarray as xr

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT = os.path.join(ROOT, "glorys_surface_2026-06-23.nc")
OUTPUT_DIR = os.path.join(ROOT, "ocean-hero-app", "public", "data", "glorys")
BINARY = os.path.join(OUTPUT_DIR, "glorys_surface.bin")
METADATA = os.path.join(OUTPUT_DIR, "glorys_surface.meta.json")
os.makedirs(OUTPUT_DIR, exist_ok=True)

VARIABLES = ["thetao", "so", "uo", "vo", "zos"]

ds = xr.open_dataset(INPUT, decode_times=True, mask_and_scale=True)
latitudes = ds["latitude"].values.astype(np.float64)
longitudes = ds["longitude"].values.astype(np.float64)

arrays = {}
for variable in VARIABLES:
    values = ds[variable].squeeze(drop=True).values.astype(np.float32)
    values[~np.isfinite(values)] = np.nan
    arrays[variable] = values

# Current fallback is valid only when both vector components exist at a cell.
current_invalid = ~np.isfinite(arrays["uo"]) | ~np.isfinite(arrays["vo"])
arrays["uo"][current_invalid] = np.nan
arrays["vo"][current_invalid] = np.nan

# Layout: row-major latitude/longitude, [thetao, so, uo, vo, zos] Float32.
interleaved = np.stack([arrays[variable] for variable in VARIABLES], axis=-1)
interleaved.astype("<f4").tofile(BINARY)

valid_counts = {variable: int(np.count_nonzero(np.isfinite(arrays[variable]))) for variable in VARIABLES}
missing_counts = {variable: int(np.count_nonzero(~np.isfinite(arrays[variable]))) for variable in VARIABLES}

def stats(values):
    valid = values[np.isfinite(values)]
    return {
        "min": float(np.min(valid)) if valid.size else None,
        "max": float(np.max(valid)) if valid.size else None,
        "mean": float(np.mean(valid)) if valid.size else None,
    }

time_value = ds["time"].values.item()
if isinstance(time_value, np.datetime64):
    timestamp = str(time_value.astype("datetime64[s]")).replace(" ", "T") + "Z"
else:
    timestamp = datetime.fromtimestamp(float(time_value) / 1e9, tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

metadata = {
    "source": "Copernicus Marine GLORYS12V1",
    "product": "GLOBAL_MULTIYEAR_PHY_001_030",
    "dataset": "cmems_mod_glo_phy_my_0.083deg_P1D-m",
    "timestamp": timestamp,
    "date": timestamp,
    "latitude_min": float(latitudes.min()),
    "latitude_max": float(latitudes.max()),
    "longitude_min": float(longitudes.min()),
    "longitude_max": float(longitudes.max()),
    "latMin": float(latitudes.min()),
    "latMax": float(latitudes.max()),
    "lonMin": float(longitudes.min()),
    "lonMax": float(longitudes.max()),
    "latitude_resolution": float(abs(latitudes[1] - latitudes[0])),
    "longitude_resolution": float(abs(longitudes[1] - longitudes[0])),
    "latCount": int(latitudes.size),
    "lonCount": int(longitudes.size),
    "dimensions": {"time": 1, "depth": 1, "latitude": int(latitudes.size), "longitude": int(longitudes.size)},
    "surface_depth_m": float(ds["depth"].values[0]),
    "depth": float(ds["depth"].values[0]),
    "variables": {"temperature": "thetao", "salinity": "so", "u": "uo", "v": "vo", "ssh": "zos"},
    "units": {"thetao": "degrees_C", "so": "PSU", "uo": "m/s", "vo": "m/s", "zos": "m"},
    "missing_value_representation": "NaN",
    "layout": "row_major_lat_lon_interleaved_thetao_so_uo_vo_zos_float32",
    "valid_cells": valid_counts,
    "missing_cells": missing_counts,
    "statistics": {variable: stats(arrays[variable]) for variable in VARIABLES},
    "binaryFile": "/data/glorys/glorys_surface.bin",
    "binarySize": os.path.getsize(BINARY),
}
with open(METADATA, "w", encoding="utf-8") as file:
    json.dump(metadata, file, indent=2)

print(json.dumps({
    "timestamp": timestamp,
    "source_file_bytes": os.path.getsize(INPUT),
    "binary_bytes": os.path.getsize(BINARY),
    "grid": [int(latitudes.size), int(longitudes.size)],
    "coverage": [float(latitudes.min()), float(latitudes.max()), float(longitudes.min()), float(longitudes.max())],
    "surface_depth_m": float(ds["depth"].values[0]),
    "valid_cells": valid_counts,
    "missing_cells": missing_counts,
}, indent=2))
