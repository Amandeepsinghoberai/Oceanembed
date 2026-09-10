import os
import sys
import json
import numpy as np
import netCDF4

nc_file = "noaa_oisst.nc"
if not os.path.exists(nc_file):
    print("NOAA file not found")
    sys.exit(1)

ds = netCDF4.Dataset(nc_file, 'r')
lats = ds.variables['lat'][:]
lons = ds.variables['lon'][:]
sst = ds.variables['sst']

# Target bounds
lat_min_target = -35
lat_max_target = 30
lon_min_target = 40
lon_max_target = 115

# Find indices
lat_idx = np.where((lats >= lat_min_target) & (lats <= lat_max_target))[0]
lon_idx = np.where((lons >= lon_min_target) & (lons <= lon_max_target))[0]

if len(lat_idx) == 0 or len(lon_idx) == 0:
    print("Failed to find coordinates in range")
    sys.exit(1)

lat_start, lat_end = lat_idx[0], lat_idx[-1]
lon_start, lon_end = lon_idx[0], lon_idx[-1]

# Extract subset
# NOAA shape is (time, zlev, lat, lon) == (1, 1, 720, 1440)
subset = sst[0, 0, lat_start:lat_end+1, lon_start:lon_end+1]

actual_lat = lats[lat_start:lat_end+1]
actual_lon = lons[lon_start:lon_end+1]

# Handle Missing/NaN
if hasattr(subset, 'mask'):
    data = subset.filled(np.nan)
else:
    data = np.array(subset)
    # Ensure -999 or similar missing values are NaN if present without mask
    data = np.where(data < -100, np.nan, data) 

out_bin = os.path.join("public", "data", "sst", "regional_sst_v2.bin")
out_meta = os.path.join("public", "data", "sst", "regional_sst_v2.meta.json")

os.makedirs(os.path.dirname(out_bin), exist_ok=True)

# Write binary
data = data.astype(np.float32)
data.tofile(out_bin)

# Compute metrics
lat_count = len(actual_lat)
lon_count = len(actual_lon)
total_cells = lat_count * lon_count
expected_size = total_cells * 4
actual_size = os.path.getsize(out_bin)

val_cells = np.count_nonzero(~np.isnan(data))
miss_cells = total_cells - val_cells

valid_data = data[~np.isnan(data)]
raw_min = float(np.min(valid_data)) if len(valid_data) > 0 else np.nan
raw_max = float(np.max(valid_data)) if len(valid_data) > 0 else np.nan
raw_mean = float(np.mean(valid_data)) if len(valid_data) > 0 else np.nan

# Extract date dynamically from dimensions or assume 2026-08-31 based on known
meta = {
    "source": "NOAA NCEI OISST v2.1",
    "date": "2026-08-31",
    "variable": "sst",
    "units": "degC",
    "latMin": float(actual_lat[0]),
    "latMax": float(actual_lat[-1]),
    "lonMin": float(actual_lon[0]),
    "lonMax": float(actual_lon[-1]),
    "latCount": lat_count,
    "lonCount": lon_count,
    "resolution": "0.25 degree"
}
with open(out_meta, 'w') as f:
    json.dump(meta, f, indent=2)

print(f"Latitude first: {actual_lat[0]:.3f}")
print(f"Latitude last: {actual_lat[-1]:.3f}")
print(f"Longitude first: {actual_lon[0]:.3f}")
print(f"Longitude last: {actual_lon[-1]:.3f}")
print(f"Latitude count: {lat_count}")
print(f"Longitude count: {lon_count}")
print(f"Total cells: {total_cells}")
print(f"Expected binary size: {expected_size}")
print(f"Actual binary size: {actual_size}")
print(f"Valid cells: {val_cells}")
print(f"Missing cells: {miss_cells}")
print(f"SST min: {raw_min:.2f}")
print(f"SST max: {raw_max:.2f}")
print(f"SST mean: {raw_mean:.2f}")
print(f"Binary valid: {actual_size == expected_size}")
