// data/RealCurrentDataProvider.js

class RealCurrentDataProviderClass {
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
      const mRes = await fetch('/data/currents/hycom_latest.meta.json');
      if (!mRes.ok) throw new Error(`Metadata error! status: ${mRes.status}`);
      const meta = await mRes.json();

      const bRes = await fetch('/data/currents/hycom_latest.bin');
      if (!bRes.ok) throw new Error(`Binary error! status: ${bRes.status}`);
      const buffer = await bRes.arrayBuffer();

      this._metadata = meta;
      this._binaryData = new Float32Array(buffer); // Interleaved U and V
      this._availableDates = [meta.timestamp || meta.date];

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
      console.error("Failed to load regional Current data:", e);
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

  getCurrent(lat, lon, dateIndex = 0) {
    if (!this.isLoaded) return null;
    
    const latIdx = this._findNearestIndex(this._latitude, lat);
    const lonIdx = this._findNearestIndex(this._longitude, lon);

    if (latIdx === -1 || lonIdx === -1) return null;
    
    // Bounds check precisely
    if (lat < this._metadata.latMin || lat > this._metadata.latMax || 
        lon < this._metadata.lonMin || lon > this._metadata.lonMax) return null;
        
    const lonCount = this._metadata.lonCount;
    const baseIdx = (latIdx * lonCount) + lonIdx;
    
    const u = this._binaryData[baseIdx * 2];
    const v = this._binaryData[baseIdx * 2 + 1];
    
    if (isNaN(u) || isNaN(v) || u === null || v === null) return null;
    
    const speed = Math.sqrt(u*u + v*v);
    
    // Direction in degrees (0 = North, 90 = East, 180 = South, 270 = West)
    let direction = Math.atan2(u, v) * (180 / Math.PI);
    if (direction < 0) direction += 360;
    
    return {
      u: Math.round(u * 1000) / 1000,
      v: Math.round(v * 1000) / 1000,
      speed: Math.round(speed * 1000) / 1000,
      direction: Math.round(direction),
      source: 'HYCOM GLBy0.08 / ESPC-D-V02',
      timestamp: this._metadata.timestamp || this._metadata.date
    };
  }

  getAvailableDates() {
    return this._availableDates;
  }
}

export const RealCurrentDataProvider = new RealCurrentDataProviderClass();
