import os
import glob
import json
import logging
import argparse
import xarray as xr
import numpy as np

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

def process_production_datasets(nc_pattern, out_dir):
    os.makedirs(out_dir, exist_ok=True)
    
    files = glob.glob(nc_pattern)
    if not files:
        logging.error(f"No NetCDF files found matching {nc_pattern}")
        return

    logging.info(f"Loading {len(files)} files...")
    
    # Load and combine all datasets safely
    # For large datasets, open_mfdataset creates a dask graph
    ds = xr.open_mfdataset(files, combine='by_coords')
    
    # We want Sea Surface Temperature (analysed_sst)
    if 'analysed_sst' not in ds.variables:
        logging.error("Variable 'analysed_sst' missing from dataset.")
        return
        
    # Aggregate native 0.05 resolution (approx) to 0.25 degrees
    # This reduces cell counts by 25x, heavily optimizing browser load
    # coarsen by factor of 5 because 0.05 * 5 = 0.25
    logging.info("Coarsening spatial dimensions by factor 5...")
    # Using boundary='trim' directly ensures safely dropping incomplete edge blocks
    try:
        ds_coarse = ds.coarsen(lat=5, lon=5, boundary='trim').mean()
        sst = ds_coarse.analysed_sst
        lats = sst.lat.values
        lons = sst.lon.values
    except Exception:
        ds_coarse = ds.coarsen(latitude=5, longitude=5, boundary='trim').mean()
        sst = ds_coarse.analysed_sst
        lats = sst.latitude.values
        lons = sst.longitude.values
    
    # Extract native components
    times = sst.time.values
    
    for i, t in enumerate(times):
        # Numpy datetime64 to string
        dt_str = str(np.datetime64(t, 's'))  # Format: 2026-09-05T00:00:00
        date_short = dt_str.split('T')[0]
        
        logging.info(f"Processing slice for {date_short}...")
        
        slice_2d = sst.isel(time=i).values
        # Save exact Float32 stream
        slice_32 = slice_2d.astype(np.float32)
        
        bin_filename = f"{date_short}.bin"
        bin_path = os.path.join(out_dir, bin_filename)
        slice_32.tofile(bin_path)
        
        # Meta descriptor 
        meta = {
            "source": "Copernicus Marine OSTIA",
            "variable": "analysed_sst",
            "date": dt_str,
            "latitude_min": float(lats.min()),
            "latitude_max": float(lats.max()),
            "longitude_min": float(lons.min()),
            "longitude_max": float(lons.max()),
            "latitude_count": len(lats),
            "longitude_count": len(lons),
            "resolution_degrees": 0.25,
            "unit": "Celsius",
            "binary_filename": bin_filename,
            "data_type": "Float32",
            "missing_value": "NaN"
        }
        
        with open(os.path.join(out_dir, f"{date_short}.meta.json"), 'w') as f:
            json.dump(meta, f, indent=2)
            
    logging.info("Production pipeline compilation completed successfully.")
    
if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', default='ostia_arabian_3day.nc')
    parser.add_argument('--out', default='public/data/sst')
    args = parser.parse_args()
    
    process_production_datasets(args.input, args.out)
