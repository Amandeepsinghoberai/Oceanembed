#!/bin/bash
# Azure App Service startup command. live_predict.py loads these .nc files
# at import time (before uvicorn can even start), so they must exist on
# disk before we launch the app. They're too large for this repo/deploy
# package (245MB + 284MB + 65MB) so they live in Azure Blob Storage instead
# and get pulled down once per container start, into the same models/
# directory the code already expects.
set -e

mkdir -p models

fetch_if_missing() {
  local name="$1"
  if [ ! -f "models/$name" ]; then
    echo "Downloading $name from blob storage..."
    curl -sSL -f "${MODEL_BLOB_BASE_URL}/${name}" -o "models/${name}.part"
    mv "models/${name}.part" "models/${name}"
  else
    echo "$name already present, skipping download."
  fi
}

fetch_if_missing "processed_sst_4yr.nc"
fetch_if_missing "processed_sst_full.nc"
fetch_if_missing "glorys_climatology_trainonly.nc"

exec gunicorn -k uvicorn.workers.UvicornWorker -w 1 -b 0.0.0.0:8000 --timeout 600 main:app
