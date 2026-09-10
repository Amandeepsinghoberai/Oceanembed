import subprocess
import json

out = subprocess.check_output(
    ['copernicusmarine', 'describe', '--dataset-id', 'cmems_mod_glo_phy_anfc_0.083deg_P1D-m', '--log-level', 'QUIET'], 
    encoding='utf-8', 
    errors='ignore'
)

start = out.find('{')
if start != -1:
    data = json.loads(out[start:])
    
    prod = data.get('products', [data])[0]
    print(f"Dataset Title: {prod.get('title')}")
    
    for ds in prod.get('datasets', []):
        if ds.get('dataset_id') == 'cmems_mod_glo_phy_anfc_0.083deg_P1D-m':
            print("Dataset found!")
            for v in ds.get('variables', []):
                if v.get('variable_name') == 'so':
                    print(f"Salinity Unit: {v.get('units')}")
            for d in ds.get('dimensions', []):
                print(f"Dimension: {d.get('dimension_name')}, "
                      f"Step: {d.get('step')}, "
                      f"Min: {d.get('min_value')}, "
                      f"Max: {d.get('max_value')}")
