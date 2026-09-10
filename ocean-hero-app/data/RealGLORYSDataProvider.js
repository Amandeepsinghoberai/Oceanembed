// data/RealGLORYSDataProvider.js

class RealGLORYSDataProviderClass {
  constructor() {
    this.isLoaded = false;
    this._metadata = null;
    this._binaryData = null;
    this._latitude = [];
    this._longitude = [];
  }

  async load() {
    if (this.isLoaded) return;

    try {
      const metadataResponse = await fetch('/data/glorys/glorys_surface.meta.json');
      if (!metadataResponse.ok) throw new Error(`GLORYS metadata error: ${metadataResponse.status}`);
      const metadata = await metadataResponse.json();

      const binaryResponse = await fetch('/data/glorys/glorys_surface.bin');
      if (!binaryResponse.ok) throw new Error(`GLORYS binary error: ${binaryResponse.status}`);

      this._metadata = metadata;
      this._binaryData = new Float32Array(await binaryResponse.arrayBuffer());
      this._latitude = Array.from({ length: metadata.latCount }, (_, index) =>
        metadata.latMin + index * (metadata.latMax - metadata.latMin) / Math.max(1, metadata.latCount - 1)
      );
      this._longitude = Array.from({ length: metadata.lonCount }, (_, index) =>
        metadata.lonMin + index * (metadata.lonMax - metadata.lonMin) / Math.max(1, metadata.lonCount - 1)
      );
      this.isLoaded = true;
    } catch (error) {
      console.error('Failed to load GLORYS fallback data:', error);
    }
  }

  _findNearestIndex(values, target) {
    if (!values.length) return -1;
    let nearestIndex = 0;
    let nearestDistance = Math.abs(values[0] - target);
    for (let index = 1; index < values.length; index += 1) {
      const distance = Math.abs(values[index] - target);
      if (distance < nearestDistance) {
        nearestIndex = index;
        nearestDistance = distance;
      }
    }
    return nearestIndex;
  }

  _getCell(lat, lon) {
    if (!this.isLoaded || lat < this._metadata.latMin || lat > this._metadata.latMax ||
        lon < this._metadata.lonMin || lon > this._metadata.lonMax) return null;

    const latIndex = this._findNearestIndex(this._latitude, lat);
    const lonIndex = this._findNearestIndex(this._longitude, lon);
    if (latIndex < 0 || lonIndex < 0) return null;

    const baseIndex = (latIndex * this._metadata.lonCount + lonIndex) * 5;
    return {
      temperature: this._binaryData[baseIndex],
      salinity: this._binaryData[baseIndex + 1],
      u: this._binaryData[baseIndex + 2],
      v: this._binaryData[baseIndex + 3],
      ssh: this._binaryData[baseIndex + 4]
    };
  }

  _value(value, unit) {
    if (!Number.isFinite(value)) return null;
    return {
      value,
      unit,
      source: 'GLORYS FALLBACK',
      timestamp: this._metadata.timestamp
    };
  }

  getTemperature(lat, lon) {
    const cell = this._getCell(lat, lon);
    return cell ? this._value(cell.temperature, '°C') : null;
  }

  getSalinity(lat, lon) {
    const cell = this._getCell(lat, lon);
    return cell ? this._value(cell.salinity, 'PSU') : null;
  }

  getCurrent(lat, lon) {
    const cell = this._getCell(lat, lon);
    if (!cell || !Number.isFinite(cell.u) || !Number.isFinite(cell.v)) return null;

    const speed = Math.sqrt(cell.u * cell.u + cell.v * cell.v);
    let direction = Math.atan2(cell.u, cell.v) * 180 / Math.PI;
    if (direction < 0) direction += 360;

    return {
      u: Math.round(cell.u * 1000) / 1000,
      v: Math.round(cell.v * 1000) / 1000,
      speed: Math.round(speed * 1000) / 1000,
      direction: Math.round(direction),
      source: 'GLORYS FALLBACK',
      timestamp: this._metadata.timestamp
    };
  }

  getSSH(lat, lon) {
    const cell = this._getCell(lat, lon);
    return cell ? this._value(cell.ssh, 'm') : null;
  }

  getMetadata() {
    return this._metadata;
  }
}

export const RealGLORYSDataProvider = new RealGLORYSDataProviderClass();
