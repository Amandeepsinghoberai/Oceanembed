"""
One-time, offline generator for public/data/recent_seasonal_profiles.json.

For each of the 5 demo points, fetches REAL near-real-time (NRT) satellite /
analysis inputs for the mid-month (15th) of every month from Jul 2024 to Sep
2026, runs each month through the same trained production model live
prediction uses (with the same per-depth bias correction), and saves the
monthly 15-depth temperature profiles.

Inputs and formulas are the ones live_predict.py's live path uses:
  Bay of Bengal : SST, SSH (+ 5-region cluster one-hot)
  Arabian Sea   : SST, SSH, wind-stress curl, MLD, SSS, eddy vorticity
                  (+ 10-region cluster one-hot)
Instead of one fetch per month, each variable is fetched ONCE as a ranged
request for the whole window (a small box around the point) and the 15th is
picked out of it. (Checked earlier: a ranged request returns exactly the values
of a single-date request.)

Training-range drift flag: for every month and every continuous input, the
real value is compared with the real training inputs of the model that
consumes it (X_train from D:/oceanembed-ml/data/dataset_cluster.npz for the
Bay, dataset_arabian_eddy.npz for the Arabian Sea):
  "outside" = beyond the training set's min/max
  "edge"    = inside min/max but beyond its 0.5th-99.5th percentile
These are stored per month so the UI can show them - never only logged.

Run from backend/:  python generate_recent_seasons.py
"""
import json
import os
import uuid
from datetime import datetime, timezone

import copernicusmarine
import numpy as np
import pandas as pd
import torch
import xarray as xr

from live_predict import (
    depths, _get_cluster_id,
    bay_model, bay_norm, bay_correction, bay_cluster_map, bay_grid_lats, bay_grid_lons,
    arabian_model, arabian_norm, arabian_correction, arabian_cluster_map, ar_grid_lats, ar_grid_lons,
)

TMP_DIR = "data/live_cache"
OUT_PATH = "../public/data/recent_seasonal_profiles.json"
DEMO_DIR = "../public/data"
TRAIN_DIR = "D:/oceanembed-ml/data"
FETCH_START, FETCH_END = "2024-07-01", "2026-09-16"
MONTHS = [d.strftime("%Y-%m-15") for d in pd.date_range("2024-07-01", "2026-09-01", freq="MS")]

DS = {
    "sst": ("METOFFICE-GLO-SST-L4-NRT-OBS-SST-V2", "analysed_sst", False),
    "ssh": ("cmems_obs-sl_glo_phy-ssh_nrt_allsat-l4-duacs-0.125deg_P1D", "sla", False),
    "sss": ("cmems_obs-mob_glo_phy-sss_nrt_multi_P1D", "sos", False),
    "mld": ("cmems_mod_glo_phy_anfc_0.083deg_P1D-m", "mlotst", False),
    "curl": ("cmems_obs-wind_glo_phy_nrt_l4_0.125deg_PT1H", "stress_curl", True),
}
# (name in the file, column in X_train, unit)
BAY_VARS = [("sst", 0, "°C"), ("ssh", 1, "m")]
AR_VARS = [("sst", 0, "°C"), ("ssh", 1, "m"), ("curl", 2, "N/m³"), ("mld", 3, "m"), ("sss", 4, "PSU"), ("vorticity", 5, "1/s")]


def training_ranges(npz_name, variables):
    """Real per-variable range of the inputs the model was trained on."""
    X = np.load(f"{TRAIN_DIR}/{npz_name}")["X_train"]
    out = {}
    for name, col, unit in variables:
        v = X[:, col]
        out[name] = {
            "min": float(v.min()), "max": float(v.max()),
            "p005": float(np.percentile(v, 0.5)), "p995": float(np.percentile(v, 99.5)),
            "unit": unit, "n_samples": int(len(v)),
        }
    del X
    return out


def fetch_range(tag, lat, lon, half):
    dataset_id, variable, hourly = DS[tag]
    fname = f"seas_{tag}_{uuid.uuid4().hex[:6]}.nc"
    copernicusmarine.subset(
        dataset_id=dataset_id, variables=[variable],
        minimum_longitude=lon - half, maximum_longitude=lon + half,
        minimum_latitude=lat - half, maximum_latitude=lat + half,
        start_datetime=FETCH_START + ("T00:00:00" if hourly else ""),
        end_datetime=FETCH_END + ("T23:00:00" if hourly else ""),
        output_directory=TMP_DIR, output_filename=fname, overwrite=True,
    )
    ds = xr.open_dataset(f"{TMP_DIR}/{fname}")
    da = ds[variable].load()
    ds.close()
    os.remove(f"{TMP_DIR}/{fname}")
    if "depth" in da.dims:
        da = da.isel(depth=0, drop=True)
    return da


def at_month(da, date, hour=0):
    """The 2-D field at exactly that date (hour 12 for the hourly wind)."""
    t = pd.Timestamp(date) + pd.Timedelta(hours=hour)
    sel = da.sel(time=t, method="nearest")
    got = pd.Timestamp(sel.time.values)
    if abs(got - t) > pd.Timedelta(hours=12) + pd.Timedelta(hours=(0 if hour else 12)):
        raise RuntimeError(f"no data near {t}: nearest is {got}")
    return sel, str(got.date())


def point_value(field2d, lat, lon):
    return float(field2d.sel(latitude=lat, longitude=lon, method="nearest"))


def flag(value, rng):
    if value < rng["min"] or value > rng["max"]:
        return "outside"
    if value < rng["p005"] or value > rng["p995"]:
        return "edge"
    return None


def run_model(x, norm, model, correction):
    x_t = torch.tensor((x - norm["X_mean"]) / norm["X_std"], dtype=torch.float32)
    with torch.no_grad():
        pred = model(x_t).cpu().numpy()[0]
    pred = pred * norm["y_std"] + norm["y_mean"]
    return [round(float(pred[i] - correction[d]), 2) for i, d in enumerate(depths)]


def build_point(pid, loc, ranges):
    lat, lon, region = loc["lat"], loc["lon"], loc["region"]
    arabian = region == "Arabian Sea"
    print(f"\n=== point {pid}: {region} {lat}N {lon}E ===", flush=True)
    fields = {}
    for tag in (["sst", "ssh", "sss", "mld", "curl"] if arabian else ["sst", "ssh"]):
        half = 0.5 if tag == "ssh" else 0.3  # SSH keeps the 1-degree patch live uses for vorticity
        fields[tag] = fetch_range(tag, lat, lon, half)
        print(f"  fetched {tag}: {dict(fields[tag].sizes)}", flush=True)

    cmap, glat, glon = (arabian_cluster_map, ar_grid_lats, ar_grid_lons) if arabian else (bay_cluster_map, bay_grid_lats, bay_grid_lons)
    cluster_id = _get_cluster_id(lat, lon, cmap, glat, glon)
    if cluster_id == -1:
        raise RuntimeError(f"point {pid} has no valid model-grid cluster")
    onehot = np.zeros(10 if arabian else 5)
    onehot[cluster_id] = 1

    months = []
    for date in MONTHS:
        entry = {"date": date}
        try:
            sst_f, d_sst = at_month(fields["sst"], date)
            ssh_f, d_ssh = at_month(fields["ssh"], date)
            sst = point_value(sst_f, lat, lon)
            if sst > 100:
                sst -= 273.15
            ssh = point_value(ssh_f, lat, lon)
            vals = {"sst": sst, "ssh": ssh}
            dates = {"sst": d_sst, "ssh": d_ssh}
            if arabian:
                sss_f, d_sss = at_month(fields["sss"], date)
                mld_f, d_mld = at_month(fields["mld"], date)
                curl_f, d_curl = at_month(fields["curl"], date, hour=12)
                vals["sss"] = point_value(sss_f, lat, lon)
                vals["mld"] = point_value(mld_f, lat, lon)
                vals["curl"] = point_value(curl_f, lat, lon)
                dates.update({"sss": d_sss, "mld": d_mld, "curl": d_curl})
                # live_predict's exact vorticity formula
                g, omega = 9.81, 7.2921e-5
                f = 2 * omega * np.sin(np.deg2rad(lat))
                dx = 111320 * np.cos(np.deg2rad(ssh_f.latitude))
                dy = 110540
                d2x = ssh_f.differentiate("longitude").differentiate("longitude") / (dx ** 2)
                d2y = ssh_f.differentiate("latitude").differentiate("latitude") / (dy ** 2)
                vals["vorticity"] = float(((g / f) * (d2x + d2y)).sel(latitude=lat, longitude=lon, method="nearest"))
            if not all(np.isfinite(v) for v in vals.values()):
                bad = [k for k, v in vals.items() if not np.isfinite(v)]
                entry.update({"predicted_temp_c": None, "unavailable_reason": f"no real value for {', '.join(bad)} on this date"})
                months.append(entry)
                continue

            if arabian:
                x = np.concatenate([[vals["sst"], vals["ssh"], vals["curl"], vals["mld"], vals["sss"], vals["vorticity"]], onehot]).reshape(1, -1).astype(np.float32)
                predicted = run_model(x, arabian_norm, arabian_model, arabian_correction)
                surface = {"sst_c": round(vals["sst"], 2), "ssh_m": round(vals["ssh"], 3), "wind_stress_curl": vals["curl"],
                           "mld_m": round(vals["mld"], 1), "sss_psu": round(vals["sss"], 2), "eddy_vorticity": vals["vorticity"]}
            else:
                x = np.concatenate([[vals["sst"], vals["ssh"]], onehot]).reshape(1, -1).astype(np.float32)
                predicted = run_model(x, bay_norm, bay_model, bay_correction)
                surface = {"sst_c": round(vals["sst"], 2), "ssh_m": round(vals["ssh"], 3)}

            flags = []
            for name, rng in ranges.items():
                level = flag(vals[name], rng)
                if level:
                    flags.append({"variable": name, "value": vals[name], "level": level,
                                  "train_min": rng["min"], "train_max": rng["max"], "unit": rng["unit"]})
            entry.update({"predicted_temp_c": predicted, "surface_state": surface, "data_dates": dates, "flags": flags})
        except Exception as e:  # a month that genuinely can't be built is recorded, never filled in
            entry.update({"predicted_temp_c": None, "unavailable_reason": f"{type(e).__name__}: {str(e)[:120]}"})
        months.append(entry)
    ok = sum(1 for m in months if m.get("predicted_temp_c"))
    fl = sum(1 for m in months if m.get("flags"))
    print(f"  {ok}/{len(months)} months built; {fl} with a training-range flag", flush=True)
    return {"id": pid, "location": loc, "cluster_id": int(cluster_id), "months": months}


def main():
    os.makedirs(TMP_DIR, exist_ok=True)
    print("Real training-input ranges...", flush=True)
    ranges = {
        "Bay of Bengal": training_ranges("dataset_cluster.npz", BAY_VARS),
        "Arabian Sea": training_ranges("dataset_arabian_eddy.npz", AR_VARS),
    }
    points = []
    for pid in range(1, 6):
        with open(f"{DEMO_DIR}/demo_{pid}.json") as f:
            loc = json.load(f)["location"]
        points.append(build_point(pid, loc, ranges[loc["region"]]))
    result = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "window": {"first": MONTHS[0], "last": MONTHS[-1], "day_of_month": 15, "n_months": len(MONTHS)},
        "depths_m": list(depths),
        "data_quality": "Near-real-time (NRT) satellite and analysis inputs run through the trained model - real, but not the fully quality-controlled data behind the official 0.637 C (Bay of Bengal) / 0.834 C (Arabian Sea) validation numbers, and not checked against Argo.",
        "sources": {k: f"{v[0]} / {v[1]}" for k, v in DS.items()},
        "training_ranges": ranges,
        "points": points,
    }
    with open(OUT_PATH, "w") as f:
        json.dump(result, f, separators=(",", ":"))
    print(f"\nWrote {OUT_PATH} ({os.path.getsize(OUT_PATH) // 1024} KB)")


if __name__ == "__main__":
    main()
