// data/RealSalinityDataProvider.js

class RealSalinityDataProviderClass {
  constructor() {
    this.data = null;
    this.isLoaded = false;
    this._metadata = null;
    this._binaryData = null;
    this._latitude = [];
    this._longitude = [];
    this._availableDates = [];
  }

  async load() {
    if (this.isLoaded) return;
    
    try {
      const mRes = await fetch('/data/salinity/smap_2026-09-07.meta.json');
      if (!mRes.ok) throw new Error(`Metadata error! status: ${mRes.status}`);
      const meta = await mRes.json();

      const bRes = await fetch('/data/salinity/smap_2026-09-07.bin');
      if (!bRes.ok) throw new Error(`Binary error! status: ${bRes.status}`);
      const buffer = await bRes.arrayBuffer();

      this._metadata = meta;
      this._binaryData = new Float32Array(buffer);
      this._availableDates = [meta.date];

      this._latitude = new Array(meta.latCount);
      const latStep = (meta.latMax - meta.latMin) / Math.max(1, meta.latCount - 1);
      for (let i = 0; i < meta.latCount; i++) {
         this._latitude[i] = meta.latMin + i * latStep;
      }

      this._longitude = new Array(meta.lonCount);
      const lonStep = (meta.lonMax - meta.lonMin) / Math.max(1, meta.lonCount - 1);
      for (let j = 0; j < meta.lonCount; j++) {
         this._longitude[j] = meta.lonMin + j * lonStep;
      }

      this.data = {
         latitude: this._latitude,
         longitude: this._longitude,
         times: this._availableDates,
         meta: meta
      };

      this.isLoaded = true;
    } catch (e) {
      console.error("Failed to load regional Salinity data:", e);
    }
  }

  _findNearestIndex(arr, val) {
    if (!arr || arr.length === 0) return -1;
    let nearestIdx = 0;
    let minDiff = Math.abs(arr[0] - val);
    for (let i = 1; i < arr.length; i++) {
        let diff = Math.abs(arr[i] - val);
        if (diff < minDiff) {
            minDiff = diff;
            nearestIdx = i;
        }
    }
    return nearestIdx;
  }

  getSalinity(lat, lon, dateIndex = 0) {
    if (!this.isLoaded) return null;

    const latIdx = this._findNearestIndex(this._latitude, lat);
    const lonIdx = this._findNearestIndex(this._longitude, lon);

    if (latIdx === -1 || lonIdx === -1) return null;
    
    // Bounds check
    if (latIdx < 0 || latIdx >= this._metadata.latCount || lonIdx < 0 || lonIdx >= this._metadata.lonCount) return null;
    
    const lonCount = this._metadata.lonCount;
    const val = this._binaryData[(latIdx * lonCount) + lonIdx];
    
    if (isNaN(val) || val === null) return null;
    
    // Presentation: rounding to 1 decimal place as requested in typical OceanEmbed panels
    // Return float
    return Math.round(val * 10) / 10;
  }

  getAvailableDates() {
    return this._availableDates;
  }
}

export const RealSalinityDataProvider = new RealSalinityDataProviderClass();
