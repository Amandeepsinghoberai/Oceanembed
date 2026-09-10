import json
import codecs

try:
    with codecs.open('cmems_describe.json', 'r', encoding='utf-16le') as f:
        data = json.load(f)
except:
    with codecs.open('cmems_describe.json', 'r', encoding='utf-8') as f:
        data = json.load(f)

products = data.get("products", [data])
if products:
    p = products[0]
    print(f"Title: {p.get('title')}")
    for ds in p.get("datasets", []):
        if ds.get('dataset_id') == 'cmems_mod_glo_phy_anfc_0.083deg_P1D-m':
            print("Dataset found!")
            for var in ds.get("variables", []):
                if var.get('variable_name') == 'so':
                    print(f"Variable: {var}")
            dims = ds.get('dimensions', [])
            print(f"Dims: {dims}")
