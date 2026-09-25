"""
One-time, offline generator for public/data/regional_confidence_grid.json.

Real model-disagreement ("confidence") map for the Bay of Bengal:
  1. Takes the real SST from public/data/regional_sst_grid.json (the same
     satellite snapshot the SST heatmap draws) - nothing re-fetched for SST.
  2. Fetches the real SSH (DUACS NRT `sla`, the exact product/variable the live
     Bay of Bengal prediction uses) for that snapshot's date.
  3. For every ocean cell inside the ensemble's training domain (5-22N,
     80-100E) that has BOTH a real SST and a real SSH, runs all 7 real trained
     ensemble models (2-input SST+SSH -> 15-depth temperature) on that cell's
     inputs.
  4. Stores, per cell, the standard deviation across the 7 members' predictions
     (sample std, ddof=1), averaged over the 15 depths, in degrees C.
     Low = the 7 independently trained models agree; high = they disagree.

Cells outside the domain, on land, or missing either input are null - never
estimated. Same file layout as regional_sst_grid.json.

ARABIAN SEA (region "arabian"): same idea with the real 7-member Arabian
ensemble (ensemble_model_arabian_0..6.pt), which uses the production Arabian
model's full 16-input architecture: SST, SSH, wind-stress curl, mixed-layer
depth, salinity, eddy vorticity + the 10-region cluster one-hot. Inputs are
gathered with the SAME datasets, variables, nearest-cell lookup, cluster lookup
and vorticity formula as live_predict.py's Arabian path - but as ONE grid-wide
request per variable (4 requests) instead of per-cell fetches. Written to a
separate file, regional_confidence_grid_arabian.json, so the Bay file is never
touched.

Run from the backend/ folder:
  python generate_confidence_grid.py bay        # -> regional_confidence_grid.json
  python generate_confidence_grid.py arabian    # -> regional_confidence_grid_arabian.json
"""
import json
import os
import sys
import uuid
from datetime import datetime, timezone

import copernicusmarine
import numpy as np
import torch
import torch.nn as nn
import xarray as xr

MODELS_DIR = "models"
SST_GRID_PATH = "../public/data/regional_sst_grid.json"
OUT_PATH = "../public/data/regional_confidence_grid.json"
TMP_DIR = "data/live_cache"

# The ensemble's real training domain (processed_sst_4yr.nc's own extent).
DOMAIN_LAT = (5.0, 22.0)
DOMAIN_LON = (80.0, 100.0)
N_MODELS = 7
SSH_DATASET = "cmems_obs-sl_glo_phy-ssh_nrt_allsat-l4-duacs-0.125deg_P1D"


class MLP(nn.Module):
    # Same architecture as live_predict.MLP - state dicts load into it directly.
    def __init__(self, n_inputs):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(n_inputs, 48), nn.ReLU(), nn.Dropout(0.15),
            nn.Linear(48, 48), nn.ReLU(), nn.Dropout(0.15),
            nn.Linear(48, 15),
        )

    def forward(self, x):
        return self.net(x)


def build_bay():
    os.makedirs(TMP_DIR, exist_ok=True)
    with open(SST_GRID_PATH) as f:
        sst_grid = json.load(f)
    date = sst_grid["date"]
    sst = np.array([[np.nan if v is None else v for v in row] for row in sst_grid["values"]], dtype=np.float64)
    rows, cols = sst.shape
    lats = sst_grid["lat_min"] + sst_grid["lat_step"] * np.arange(rows)
    lons = sst_grid["lon_min"] + sst_grid["lon_step"] * np.arange(cols)
    print(f"SST grid: {rows}x{cols}, date {date}, {int(np.isfinite(sst).sum())} real ocean cells")

    # ---- real SSH for the same date, Bay-domain box only ----
    fname = f"conf_ssh_{date}_{uuid.uuid4().hex[:6]}.nc"
    copernicusmarine.subset(
        dataset_id=SSH_DATASET, variables=["sla"],
        minimum_longitude=DOMAIN_LON[0] - 0.5, maximum_longitude=DOMAIN_LON[1] + 0.5,
        minimum_latitude=DOMAIN_LAT[0] - 0.5, maximum_latitude=DOMAIN_LAT[1] + 0.5,
        start_datetime=date, end_datetime=date,
        output_directory=TMP_DIR, output_filename=fname, overwrite=True,
    )
    ssh_da = xr.open_dataset(f"{TMP_DIR}/{fname}")["sla"].isel(time=0).load()
    os.remove(f"{TMP_DIR}/{fname}")

    # Nearest real SSH reading to each SST cell centre - the same nearest-cell
    # lookup the live prediction path uses. tolerance stops it reaching across
    # a gap: a cell with no SSH within half a DUACS cell stays missing.
    ssh = np.full_like(sst, np.nan)
    in_domain = np.zeros_like(sst, dtype=bool)
    for i, la in enumerate(lats):
        if not (DOMAIN_LAT[0] <= la <= DOMAIN_LAT[1]):
            continue
        for j, lo in enumerate(lons):
            if not (DOMAIN_LON[0] <= lo <= DOMAIN_LON[1]):
                continue
            in_domain[i, j] = True
            try:
                v = float(ssh_da.sel(latitude=la, longitude=lo, method="nearest", tolerance=0.07))
            except KeyError:
                continue
            ssh[i, j] = v
    usable = in_domain & np.isfinite(sst) & np.isfinite(ssh)
    print(f"In-domain cells: {int(in_domain.sum())}; with real SST and SSH: {int(usable.sum())}")

    # ---- run the 7 real ensemble models ----
    norm = np.load(f"{MODELS_DIR}/normalization_stats_4yr.npz")
    x = np.stack([sst[usable], ssh[usable]], axis=1).astype(np.float32)
    x_norm = torch.tensor((x - norm["X_mean"]) / norm["X_std"], dtype=torch.float32)
    preds = []
    for k in range(N_MODELS):
        model = MLP(n_inputs=2)
        model.load_state_dict(torch.load(f"{MODELS_DIR}/ensemble_model_{k}.pt", map_location="cpu"))
        model.eval()
        with torch.no_grad():
            p = model(x_norm).numpy() * norm["y_std"] + norm["y_mean"]
        preds.append(p)
    preds = np.stack(preds)                      # (7, n_cells, 15 depths), degrees C
    per_depth_std = preds.std(axis=0, ddof=1)    # (n_cells, 15)
    mean_std = per_depth_std.mean(axis=1)        # (n_cells,)

    out = np.full(sst.shape, np.nan)
    out[usable] = mean_std
    values = [[None if not np.isfinite(v) else round(float(v), 4) for v in row] for row in out]

    result = {
        "date": date,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "lat_min": sst_grid["lat_min"], "lat_max": sst_grid["lat_max"],
        "lon_min": sst_grid["lon_min"], "lon_max": sst_grid["lon_max"],
        "lat_step": sst_grid["lat_step"], "lon_step": sst_grid["lon_step"],
        "statistic": "Sample standard deviation (ddof=1) across the 7 ensemble models' predicted temperatures, averaged over the model's 15 depths (0-1000 m). Degrees C.",
        "n_models": N_MODELS,
        "domain": {"lat": list(DOMAIN_LAT), "lon": list(DOMAIN_LON), "region": "Bay of Bengal"},
        "inputs": {"sst": "regional_sst_grid.json (same real satellite snapshot)", "ssh": f"{SSH_DATASET} / sla, {date}"},
        "values": values,
    }
    with open(OUT_PATH, "w") as f:
        json.dump(result, f, separators=(",", ":"))

    finite = mean_std
    print(f"Wrote {OUT_PATH}: {len(finite)} real cells")
    print(f"mean-over-depth std (C): min {finite.min():.4f}  p25 {np.percentile(finite,25):.4f}  median {np.median(finite):.4f}  p75 {np.percentile(finite,75):.4f}  p99 {np.percentile(finite,99):.4f}  max {finite.max():.4f}")

    # ---- hand-check material: extremes and typical points ----
    idx = np.argwhere(usable)
    order = np.argsort(mean_std)
    def show(tag, n):
        i, j = idx[n]
        print(f"  {tag:>10}: lat {lats[i]:.3f} lon {lons[j]:.3f}  SST {sst[i,j]:.2f}  SSH {ssh[i,j]:.3f}  mean-std {mean_std[n]:.4f}  max-depth-std {per_depth_std[n].max():.3f} at {[0,5,10,20,30,50,75,100,125,150,200,300,500,700,1000][int(per_depth_std[n].argmax())]} m")
    show("lowest", order[0]); show("median", order[len(order) // 2]); show("highest", order[-1])
    coldest = int(np.argmin(sst[usable])); hottest = int(np.argmax(sst[usable]))
    lowssh = int(np.argmin(ssh[usable])); highssh = int(np.argmax(ssh[usable]))
    show("coldest SST", coldest); show("hottest SST", hottest); show("lowest SSH", lowssh); show("highest SSH", highssh)
    print("corr(mean-std, |SST-mean|/std):", round(float(np.corrcoef(mean_std, np.abs(x[:,0]-norm['X_mean'][0])/norm['X_std'][0])[0,1]),3))
    print("corr(mean-std, |SSH-mean|/std):", round(float(np.corrcoef(mean_std, np.abs(x[:,1]-norm['X_mean'][1])/norm['X_std'][1])[0,1]),3))




# ============================ ARABIAN SEA ============================
AR_OUT_PATH = "../public/data/regional_confidence_grid_arabian.json"
AR_LON_MAX = 77.0  # exclusive - matches live_predict._classify_region
AR_DATASETS = {
    "ssh": ("cmems_obs-sl_glo_phy-ssh_nrt_allsat-l4-duacs-0.125deg_P1D", "sla", False),
    "sss": ("cmems_obs-mob_glo_phy-sss_nrt_multi_P1D", "sos", False),
    "mld": ("cmems_mod_glo_phy_anfc_0.083deg_P1D-m", "mlotst", False),
    "curl": ("cmems_obs-wind_glo_phy_nrt_l4_0.125deg_PT1H", "stress_curl", True),
}


def _fetch_field(tag, date):
    """One grid-wide real fetch over the whole Arabian Sea box; returns a
    (latitude, longitude) DataArray held in memory."""
    dataset_id, variable, hourly = AR_DATASETS[tag]
    fname = f"conf_ar_{tag}_{date}_{uuid.uuid4().hex[:6]}.nc"
    start = f"{date}T12:00:00" if hourly else date
    copernicusmarine.subset(
        dataset_id=dataset_id, variables=[variable],
        minimum_longitude=44.5, maximum_longitude=77.5, minimum_latitude=4.5, maximum_latitude=30.5,
        start_datetime=start, end_datetime=start,
        output_directory=TMP_DIR, output_filename=fname, overwrite=True,
    )
    ds = xr.open_dataset(f"{TMP_DIR}/{fname}")
    da = ds[variable].load()
    ds.close()
    os.remove(f"{TMP_DIR}/{fname}")
    if "time" in da.dims:
        da = da.isel(time=0)
    return da.squeeze(drop=True)


def build_arabian():
    os.makedirs(TMP_DIR, exist_ok=True)
    # Reuse live_predict's own cluster map + lookup so the cell->cluster
    # assignment is identical to the production Arabian prediction path.
    from live_predict import _get_cluster_id, arabian_cluster_map, ar_grid_lats, ar_grid_lons, arabian_model, arabian_norm

    with open(SST_GRID_PATH) as f:
        sst_grid = json.load(f)
    date = sst_grid["date"]
    sst = np.array([[np.nan if v is None else v for v in row] for row in sst_grid["values"]], dtype=np.float64)
    rows, cols = sst.shape
    lats = sst_grid["lat_min"] + sst_grid["lat_step"] * np.arange(rows)
    lons = sst_grid["lon_min"] + sst_grid["lon_step"] * np.arange(cols)

    cand = [(i, j) for i in range(rows) for j in range(cols)
            if 5.0 <= lats[i] <= 30.0 and 45.0 <= lons[j] < AR_LON_MAX and np.isfinite(sst[i, j])]
    print(f"Arabian candidate cells (real SST, inside 5-30N / 45-77E): {len(cand)}")

    fields = {}
    for tag in AR_DATASETS:
        fields[tag] = _fetch_field(tag, date)
        print(f"  fetched {tag}: {dict(fields[tag].sizes)}")

    ci = np.array([c[0] for c in cand])
    cj = np.array([c[1] for c in cand])
    clat = xr.DataArray(lats[ci], dims="c")
    clon = xr.DataArray(lons[cj], dims="c")

    def nearest(da):
        return da.sel(latitude=clat, longitude=clon, method="nearest").values.astype(np.float64)

    ssh_v, sss_v, mld_v, curl_v = nearest(fields["ssh"]), nearest(fields["sss"]), nearest(fields["mld"]), nearest(fields["curl"])

    # Eddy vorticity: live_predict's exact formula. The Laplacian is taken over
    # the whole SSH field (central differences, same as its 1-degree patch at
    # the point); g/f uses each cell's own latitude, as live does per point.
    ssh_f = fields["ssh"]
    dx = 111320 * np.cos(np.deg2rad(ssh_f.latitude))
    dy = 110540
    lap = ssh_f.differentiate("longitude").differentiate("longitude") / (dx ** 2) + ssh_f.differentiate("latitude").differentiate("latitude") / (dy ** 2)
    g, omega = 9.81, 7.2921e-5
    f_cor = 2 * omega * np.sin(np.deg2rad(lats[ci]))
    vort_v = (g / f_cor) * nearest(lap)

    cluster = np.array([_get_cluster_id(lats[i], lons[j], arabian_cluster_map, ar_grid_lats, ar_grid_lons) for i, j in cand])
    sst_v = sst[ci, cj]

    inputs6 = np.stack([sst_v, ssh_v, curl_v, mld_v, sss_v, vort_v], axis=1)
    finite = np.isfinite(inputs6).all(axis=1)
    ok = finite & (cluster >= 0)
    n_ok = int(ok.sum())
    print(f"Cells with all 6 real inputs and a valid model-grid cluster: {n_ok} of {len(cand)}"
          f"  (dropped: {int((~finite).sum())} missing an input, {int((cluster < 0).sum())} with no valid model-grid cluster)")

    onehot = np.zeros((n_ok, 10))
    onehot[np.arange(n_ok), cluster[ok]] = 1
    x = np.concatenate([inputs6[ok], onehot], axis=1).astype(np.float32)
    x_norm = torch.tensor((x - arabian_norm["X_mean"]) / arabian_norm["X_std"], dtype=torch.float32)

    preds = []
    for k in range(N_MODELS):
        model = MLP(n_inputs=16)
        model.load_state_dict(torch.load(f"{MODELS_DIR}/ensemble_model_arabian_{k}.pt", map_location="cpu"))
        model.eval()
        with torch.no_grad():
            preds.append(model(x_norm).numpy() * arabian_norm["y_std"] + arabian_norm["y_mean"])
    preds = np.stack(preds)
    per_depth_std = preds.std(axis=0, ddof=1)
    mean_std = per_depth_std.mean(axis=1)

    # Sanity check only (not stored): does the ensemble agree with the actual
    # production Arabian model on the same inputs?
    with torch.no_grad():
        prod = arabian_model(x_norm.to(next(arabian_model.parameters()).device)).cpu().numpy() * arabian_norm["y_std"] + arabian_norm["y_mean"]
    ens_mean = preds.mean(axis=0)
    print(f"Sanity: |ensemble mean - production model| averaged over cells and depths: {np.abs(ens_mean - prod).mean():.3f} C"
          f"  (surface {np.abs(ens_mean[:, 0] - prod[:, 0]).mean():.3f} C, 1000 m {np.abs(ens_mean[:, 14] - prod[:, 14]).mean():.3f} C)")

    out = np.full(sst.shape, np.nan)
    sel_i, sel_j = ci[ok], cj[ok]
    out[sel_i, sel_j] = mean_std
    values = [[None if not np.isfinite(v) else round(float(v), 4) for v in row] for row in out]

    result = {
        "date": date,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "lat_min": sst_grid["lat_min"], "lat_max": sst_grid["lat_max"],
        "lon_min": sst_grid["lon_min"], "lon_max": sst_grid["lon_max"],
        "lat_step": sst_grid["lat_step"], "lon_step": sst_grid["lon_step"],
        "statistic": "Sample standard deviation (ddof=1) across the 7 Arabian Sea ensemble models' predicted temperatures, averaged over the model's 15 depths (0-1000 m). Degrees C.",
        "n_models": N_MODELS,
        "domain": {"lat": [5.0, 30.0], "lon": [45.0, AR_LON_MAX], "region": "Arabian Sea"},
        "inputs": {
            "sst": "regional_sst_grid.json (same real satellite snapshot)",
            **{k: f"{v[0]} / {v[1]}, {date}" for k, v in AR_DATASETS.items()},
            "vorticity": "computed from the SSH field with live_predict's formula",
            "cluster": "cluster_map_arabian_curl.npy, 10-region one-hot",
        },
        "values": values,
    }
    with open(AR_OUT_PATH, "w") as f:
        json.dump(result, f, separators=(",", ":"))
    print(f"Wrote {AR_OUT_PATH}: {len(mean_std)} real cells")
    print(f"mean-over-depth std (C): min {mean_std.min():.4f}  p25 {np.percentile(mean_std, 25):.4f}  median {np.median(mean_std):.4f}  p75 {np.percentile(mean_std, 75):.4f}  p99 {np.percentile(mean_std, 99):.4f}  max {mean_std.max():.4f}")

    depths_m = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000]
    names = ["SST", "SSH", "curl", "MLD", "SSS", "vorticity"]
    xs = inputs6[ok]
    cl_ok = cluster[ok]
    order = np.argsort(mean_std)

    def show(tag, n):
        print(f"  {tag:>8}: lat {lats[sel_i[n]]:.3f} lon {lons[sel_j[n]]:.3f} cluster {cl_ok[n]}  "
              + " ".join(f"{nm}={xs[n, k]:.4g}" for k, nm in enumerate(names))
              + f"  mean-std {mean_std[n]:.4f}  max-depth-std {per_depth_std[n].max():.3f} at {depths_m[int(per_depth_std[n].argmax())]} m")

    show("lowest", order[0])
    show("median", order[len(order) // 2])
    show("highest", order[-1])
    for k, nm in enumerate(names):
        z = np.abs((xs[:, k] - arabian_norm["X_mean"][k]) / arabian_norm["X_std"][k])
        print(f"  corr(mean-std, |{nm} z-score|) = {np.corrcoef(mean_std, z)[0, 1]:.3f}   (max z {z.max():.1f})")


if __name__ == "__main__":
    which = sys.argv[1] if len(sys.argv) > 1 else ""
    if which == "bay":
        build_bay()
    elif which == "arabian":
        build_arabian()
    else:
        raise SystemExit("usage: python generate_confidence_grid.py bay|arabian")
