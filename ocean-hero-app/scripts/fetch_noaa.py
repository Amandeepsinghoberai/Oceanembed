import os
import sys
import subprocess
import re
import glob

# 1. Clean up broken sst binaries
sst_dir = r"C:\Users\sarth\Downloads\oceanembed-clean-v2\ocean-hero-app\public\data\sst"
if os.path.exists(sst_dir):
    for f in glob.glob(os.path.join(sst_dir, "*")):
        os.remove(f)
    print("Cleaned up broken production binaries.")

base_url = "https://www.ncei.noaa.gov/data/sea-surface-temperature-optimum-interpolation/v2.1/access/avhrr/"
out_file = r"C:\Users\sarth\Downloads\oceanembed-clean-v2\ocean-hero-app\noaa_oisst.nc"

def run_curl(url):
    res = subprocess.run(["curl.exe", "--noproxy", "*", "-k", "-s", url], capture_output=True, text=True)
    return res.stdout

dirs = ["202609", "202608"]
downloaded = False

for d in reversed(dirs):
    dir_url = f"{base_url}{d}/"
    print(f"Checking directory: {dir_url}")
    
    html_d = run_curl(dir_url)
    ncs = re.findall(r'href="(.*?\.nc)"', html_d)
    
    if ncs:
        latest_nc = sorted(ncs)[-1]
        final_url = f"{dir_url}{latest_nc}"
        print(f"Downloading latest available file: {final_url}")
        
        # Download straight to file
        subprocess.run(["curl.exe", "--noproxy", "*", "-k", "-s", "-o", out_file, final_url])
        
        if os.path.exists(out_file) and os.path.getsize(out_file) > 0:
            print("Downloaded successfully.")
            downloaded = True
            break
        else:
            print("Download failed or 0 bytes.")
    else:
        print(f"No NC files in {d}. Snippet: {html_d[:200]}")

if not downloaded:
    print("Failed to download any NC file.")
    sys.exit(1)
