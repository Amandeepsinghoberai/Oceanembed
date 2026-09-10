import os
import xarray as xr
import numpy as np

file_path = 'ostia_production_2026-09-07.nc'
if not os.path.exists(file_path):
    print("File not found.")
    exit(1)

ds = xr.open_dataset(file_path)
sst = ds.analysed_sst.values
time = ds.time.values
lat = ds.latitude.values
lon = ds.longitude.values

print(f"Dimensions: {ds.dims}")
print(f"Actual time coordinate: {time}")
print(f"Latitude min/max: {lat.min():.2f} / {lat.max():.2f}")
print(f"Longitude min/max: {lon.min():.2f} / {lon.max():.2f}")
print(f"SST shape: {sst.shape}")
print(f"dtype: {sst.dtype}")

valid_count = np.count_nonzero(~np.isnan(sst))
missing_count = np.count_nonzero(np.isnan(sst))
print(f"valid cell count: {valid_count}")
print(f"missing cell count: {missing_count}")

# Convert to Celsius for reporting exactly as the client requires
if len(sst[~np.isnan(sst)]) > 0:
    valid_sst_c = sst[~np.isnan(sst)] - 273.15
    print(f"Minimum SST in Celsius: {valid_sst_c.min():.2f}")
    print(f"Maximum SST in Celsius: {valid_sst_c.max():.2f}")
    print(f"Mean SST in Celsius: {valid_sst_c.mean():.2f}")
else:
    print("No valid data found inside the slice!")

file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
print(f"File size: {file_size_mb:.2f} MB")
