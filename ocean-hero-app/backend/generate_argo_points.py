"""
Generates a small, static snapshot of real Argo float positions within
OceanEmbed's two real trained-model coverage regions, from the last 30 days -
shown on the map as honest visual context (never a prediction, never a
validation of any number shown elsewhere), same "static file, refreshed
periodically" pattern as public/data/regional_sst_grid.json.

Run manually, or on a periodic schedule (e.g. a daily cron/task), to refresh
the file the frontend actually reads:
    cd backend && python generate_argo_points.py
"""
import json
import os
import re
import time
from datetime import datetime, timezone

import pandas as pd
import requests

LIVE_DIR = "data/live_cache"
INDEX_PATH = f"{LIVE_DIR}/argo_index_latest.txt"
OUTPUT_PATH = "../public/data/recent_argo_points.json"

# Same real bounds as this file's own _classify_region() and
# components/solution/RealOceanMap.jsx's classifyRegion() - kept in sync by
# hand, not imported, since this script is meant to run standalone/offline.
COVERAGE_LAT_MIN, COVERAGE_LAT_MAX = 5.0, 30.0
ARABIAN_LON_MIN, ARABIAN_LON_MAX = 45.0, 77.0  # exclusive upper bound
BAY_LON_MIN, BAY_LON_MAX = 80.0, 100.0
WINDOW_DAYS = 30

FLOAT_ID_RE = re.compile(r"^[^/]+/([^/]+)/")


def classify_region(lat, lon):
    if not (COVERAGE_LAT_MIN <= lat <= COVERAGE_LAT_MAX):
        return None
    if ARABIAN_LON_MIN <= lon < ARABIAN_LON_MAX:
        return "Arabian Sea"
    if BAY_LON_MIN <= lon <= BAY_LON_MAX:
        return "Bay of Bengal"
    return None


def load_index(max_age_hours=24):
    os.makedirs(LIVE_DIR, exist_ok=True)
    fresh_on_disk = (
        os.path.exists(INDEX_PATH)
        and (time.time() - os.path.getmtime(INDEX_PATH)) < max_age_hours * 3600
    )
    if not fresh_on_disk:
        print("Downloading real Argo global index (~300MB)...")
        url = "https://data-argo.ifremer.fr/ar_index_global_prof.txt"
        r = requests.get(url, timeout=120)
        r.raise_for_status()
        with open(INDEX_PATH, "wb") as f:
            f.write(r.content)
    else:
        print("Reusing on-disk index (< 24h old).")

    df = pd.read_csv(INDEX_PATH, comment="#")
    df["date"] = pd.to_datetime(df["date"], format="%Y%m%d%H%M%S", errors="coerce")
    return df


def main():
    df = load_index()
    cutoff = pd.Timestamp.now() - pd.Timedelta(days=WINDOW_DAYS)
    recent = df[df["date"] >= cutoff].dropna(subset=["latitude", "longitude", "date", "file"])

    rows = []
    for _, row in recent.iterrows():
        lat, lon = float(row["latitude"]), float(row["longitude"])
        region = classify_region(lat, lon)
        if region is None:
            continue
        m = FLOAT_ID_RE.match(str(row["file"]))
        float_id = m.group(1) if m else str(row["file"])
        rows.append({
            "float_id": float_id,
            "lat": lat,
            "lon": lon,
            "date": row["date"],
            "region": region,
        })

    if not rows:
        print("No real Argo floats found in either coverage region in the last "
              f"{WINDOW_DAYS} days - writing an empty points list (a real, valid outcome).")
        points = []
    else:
        # A float reports repeatedly as it profiles/drifts - keep only its
        # single most recent position in this window, so the map shows real
        # current float locations rather than a smeared trail of every past
        # profile from the same float.
        by_float = pd.DataFrame(rows).sort_values("date").groupby("float_id").tail(1)
        points = [
            {
                "float_id": r["float_id"],
                "lat": round(r["lat"], 3),
                "lon": round(r["lon"], 3),
                "date": str(r["date"].date()),
                "region": r["region"],
            }
            for _, r in by_float.iterrows()
        ]

    output = {
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "window_days": WINDOW_DAYS,
        "points": points,
    }
    os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"Wrote {len(points)} real Argo float positions to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
