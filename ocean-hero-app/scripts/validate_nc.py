import os
import sys

nc_file = "noaa_oisst.nc"
print(f"Validation of {nc_file}")

if not os.path.exists(nc_file):
    print("File does not exist")
    sys.exit(1)

size = os.path.getsize(nc_file)
print(f"File size: {size} bytes ({size/1024/1024:.2f} MB)")
if size == 0:
    print("File is 0 bytes")
    sys.exit(1)

try:
    import netCDF4
    import numpy as np
    ds = netCDF4.Dataset(nc_file, 'r')
    print("NetCDF opens successfully: Yes")
    
    sst_var = None
    for v in ds.variables:
        if 'sst' in v.lower():
            sst_var = v
            break
            
    print(f"SST variable: {sst_var}")
    
    if sst_var:
        val = ds.variables[sst_var]
        print(f"Dimensions: {val.shape}")
        if hasattr(val, 'units'):
            print(f"Raw SST units: {val.units}")
        else:
            print("Raw SST units: Unknown")
        
        arr = val[:]
        arr = arr[~arr.mask] if hasattr(arr, 'mask') else arr
        if len(arr) > 0:
            print(f"Raw minimum: {np.nanmin(arr)}")
            print(f"Raw maximum: {np.nanmax(arr)}")
            print(f"Raw mean: {np.nanmean(arr)}")
            
    if 'lat' in ds.variables:
        lat = ds.variables['lat'][:]
        print(f"Latitude range: {lat.min():.2f} to {lat.max():.2f}")
    
    if 'lon' in ds.variables:
        lon = ds.variables['lon'][:]
        print(f"Longitude range: {lon.min():.2f} to {lon.max():.2f}")
        
except Exception as e:
    print(f"Error reading file: {e}")
