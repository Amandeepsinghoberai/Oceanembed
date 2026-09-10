import os
import json
import xarray as xr
import numpy as np
import pandas as pd

nc_path = 'ostia_arabian_3day.nc'
bin_out = 'public/data/ostia_arabian_3day.bin'
meta_out = 'public/data/ostia_arabian_3day.meta.json'

os.makedirs('public/data', exist_ok=True)

# 1 & 2: Process Data
print(f"Opening {nc_path}...")
ds = xr.open_dataset(nc_path)
time = ds.time.values
lat = ds.latitude.values
lon = ds.longitude.values

# Convert Kelvin to Celsius and explicitly cast to float32
sst_k = ds['analysed_sst'].values
sst_c = sst_k - 273.15
sst_c_f32 = sst_c.astype(np.float32)

# Write Binary directly
with open(bin_out, 'wb') as f:
    f.write(sst_c_f32.tobytes())

# 3: Metadata
times_str = pd.to_datetime(time).strftime('%Y-%m-%dT%H:%M:%SZ').tolist()

metadata = {
    "source": "Copernicus Marine OSTIA",
    "variable": "analysed_sst",
    "unit": "Celsius",
    "dates": times_str,
    "latitude_min": float(lat.min()),
    "latitude_max": float(lat.max()),
    "longitude_min": float(lon.min()),
    "longitude_max": float(lon.max()),
    "latitude_count": len(lat),
    "longitude_count": len(lon),
    "time_count": len(time),
    "binary_filename": "ostia_arabian_3day.bin",
    "data_type": "Float32",
    "missing_value": "NaN"
}

with open(meta_out, 'w') as f:
    json.dump(metadata, f, indent=2)

size_kb = os.path.getsize(bin_out) / 1024
print(f"Exported binary to {bin_out} ({size_kb:.2f} KB)")
print(f"Exported meta to {meta_out}")
print("-" * 30)

# 7: Verification
print("Running pipeline verification...")
with open(bin_out, 'rb') as f:
    raw = f.read()

# Reconstruct shape
shape = (len(time), len(lat), len(lon))
decoded = np.frombuffer(raw, dtype=np.float32).reshape(shape)

dim_match = decoded.shape == sst_k.shape
print(f"Dimension match: {dim_match} {decoded.shape}")

# Ignore NaNs during diff check
diff = np.abs(decoded - sst_c_f32)
diff_valid = diff[~np.isnan(diff)]
if len(diff_valid) == 0:    pass
else:
    max_diff = float(np.max(diff_valid))
    print(f"Maximum numerical divergence (precision rounding): {max_diff}")

# Missing mask consistency
orig_nan = np.isnan(sst_c_f32)
dec_nan = np.isnan(decoded)
mask_match = np.array_equal(orig_nan, dec_nan)
print(f"Missing mask consistent: {mask_match}")

# Verify target default coordinates (15.42N, 63.18E)
print("-" * 30)
print(f"Verifying standard default coordinates (15.42°N, 63.18°E)")
lat_idx = (np.abs(lat - 15.42)).argmin()
lon_idx = (np.abs(lon - 63.18)).argmin()

print(f"Resolved to Indices: Lat [{lat_idx}]={lat[lat_idx]:.2f}, Lon [{lon_idx}]={lon[lon_idx]:.2f}")

for i in range(len(time)):
    val = decoded[i, lat_idx, lon_idx]
    print(f"{times_str[i]} -> {val:.2f}°C")
