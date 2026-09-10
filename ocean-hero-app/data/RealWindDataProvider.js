// data/RealWindDataProvider.js
//
// Provides real NOAA GFS 10m wind data (U/V) from a binary Float32 grid.
// Source: AWS S3 noaa-gfs-bdp-pds — gfs.t00z.pgrb2.0p25.anl (2026-09-07 00z)
// Grid: 261 lat × 301 lon, 0.25° resolution, 40–115°E, -35–30°N
// Binary layout: row-major (lat × lon × 2), interleaved Float32 [U, V, U, V, ...]

class RealWindDataProviderClass {
  constructor() {
    this.isLoaded = false;
    this._metadata = null;
    this._binaryData = null;  // Float32Array — interleaved U, V
    this._latitude = [];
    this._longitude = [];
  }

  async load() {
    if (this.isLoaded) return;

    try {
      const mRes = await fetch('/data/wind/gfs_wind_2026-09-07.meta.json');
      if (!mRes.ok) throw new Error(`Wind metadata error: ${mRes.status}`);
      const meta = await mRes.json();

      const bRes = await fetch('/data/wind/gfs_wind_2026-09-07.bin');
      if (!bRes.ok) throw new Error(`Wind binary error: ${bRes.status}`);
      const buffer = await bRes.arrayBuffer();

      this._metadata = meta;
      this._binaryData = new Float32Array(buffer); // [U0,V0, U1,V1, ...]

      // Build lat/lon lookup arrays
      this._latitude = Array.from({ length: meta.latCount }, (_, i) =>
        Math.round((meta.latMin + i * meta.latRes) * 1e6) / 1e6
      );
      this._longitude = Array.from({ length: meta.lonCount }, (_, j) =>
        Math.round((meta.lonMin + j * meta.lonRes) * 1e6) / 1e6
      );

      this.isLoaded = true;
    } catch (e) {
      console.error('Failed to load GFS wind data:', e);
    }
  }

  _findNearestIndex(arr, val) {
    if (!arr || arr.length === 0) return -1;
    let nearestIdx = 0;
    let minDiff = Math.abs(arr[0] - val);
    for (let i = 1; i < arr.length; i++) {
      const diff = Math.abs(arr[i] - val);
      if (diff < minDiff) { minDiff = diff; nearestIdx = i; }
    }
    return nearestIdx;
  }

  /**
   * Returns { u, v, speed, direction, source, timestamp } or null if out-of-bounds.
   * direction: meteorological FROM convention (degrees clockwise from north).
   */
  getWind(lat, lon) {
    if (!this.isLoaded || !this._binaryData) return null;

    const meta = this._metadata;

    // Strict bounds check
    if (lat < meta.latMin || lat > meta.latMax ||
        lon < meta.lonMin || lon > meta.lonMax) return null;

    const latIdx = this._findNearestIndex(this._latitude, lat);
    const lonIdx = this._findNearestIndex(this._longitude, lon);
    if (latIdx === -1 || lonIdx === -1) return null;

    const baseIdx = (latIdx * meta.lonCount + lonIdx) * 2;
    const u = this._binaryData[baseIdx];
    const v = this._binaryData[baseIdx + 1];

    if (isNaN(u) || isNaN(v)) return null;

    const speed = Math.sqrt(u * u + v * v);

    // Meteorological FROM direction (wind blows FROM this bearing, clockwise from N)
    // FROM = 180 + atan2(U, V) in degrees
    let direction = (Math.atan2(u, v) * 180 / Math.PI + 180) % 360;
    if (direction < 0) direction += 360;

    return {
      u: Math.round(u * 1000) / 1000,
      v: Math.round(v * 1000) / 1000,
      speed: Math.round(speed * 1000) / 1000,
      direction: Math.round(direction),
      source: 'NOAA GFS 0.25° Global Analysis',
      timestamp: meta.timestamp || '2026-09-07T00:00:00Z'
    };
  }

  getMetadata() {
    return this._metadata;
  }
}

export const RealWindDataProvider = new RealWindDataProviderClass();
