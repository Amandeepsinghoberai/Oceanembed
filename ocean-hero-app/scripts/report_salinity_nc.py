import os
import xarray as xr
import numpy as np

file_path = 'ostia_salinity_test.nc'
if not os.path.exists(file_path):
    print("File not found.")
    exit(1)

ds = xr.open_dataset(file_path)

# Variable is typically 'so' or 'vosaline'
var_name = [v for v in ds.variables if 'so' in v.lower() or 'salinity' in v.lower()][0]
salinity = ds[var_name].values
time = ds.time.values
lat = ds.latitude.values
lon = ds.longitude.values

print(f"Dataset Name: Global Ocean Physics Analysis and Forecast")
print(f"Dataset ID: cmems_mod_glo_phy_anfc_0.083deg_P1D-m")
print(f"Variable Name: {var_name}")
try:
    print(f"Unit: {ds[var_name].attrs.get('units', 'PSU / 1e-3')}")
except:
    print("Unit: PSU")
print(f"Actual time coordinate: {time}")
print(f"Dimensions: {ds.dims}")
print(f"Latitude bounds: {lat.min():.2f} / {lat.max():.2f}")
print(f"Longitude bounds: {lon.min():.2f} / {lon.max():.2f}")
print(f"Native spatial resolution: {abs(lat[1]-lat[0]):.4f}°")

valid_count = np.count_nonzero(~np.isnan(salinity))
missing_count = np.count_nonzero(np.isnan(salinity))
print(f"valid cell count: {valid_count}")
print(f"missing cell count: {missing_count}")

valid_salinity = salinity[~np.isnan(salinity)]
if len(valid_salinity) > 0:
    print(f"Minimum salinity: {valid_salinity.min():.3f} PSU")
    print(f"Maximum salinity: {valid_salinity.max():.3f} PSU")
    print(f"Mean salinity: {valid_salinity.mean():.3f} PSU")
else:
    print("No valid data found inside the slice!")

file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
print(f"File size: {file_size_mb:.2f} MB")
