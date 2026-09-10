// data/MockOceanDataProvider.js

/**
 * Temporary mock architectural layer mimicking a true scientific Grid Data Provider.
 * Allows geographically specific data resolutions based on true Lat/Lon matrices.
 * TO BE REPLACED WITH RealOceanDataProvider once live telemetry is attached.
 */
export const MockOceanDataProvider = {
  getTemperature: (lat, lon, depth) => {
    // Generate mathematically stable but mock data around coordinates
    // Base temperature generally warmer near equator (lat closer to 0)
    let base = 28 - (Math.abs(lat) * 0.25);
    
    // Depth modulation (gets colder deeper)
    if (depth > 200) base -= (depth - 200) * 0.012;
    if (base < 2.5) base = 2.5;

    return {
      temp: parseFloat(base.toFixed(1)),
      anomaly: parseFloat((Math.sin(lon) + Math.cos(lat)).toFixed(1)),
      source: depth === 0 ? 'Satellite Observations' : 'Model Reconstruction'
    };
  },

  getSalinity: (lat, lon, depth) => {
    let sal = 35.1 - (depth * 0.0005) + Math.sin(lat * 0.1);
    return sal.toFixed(1) + ' PSU';
  },

  getCurrent: (lat, lon, depth) => {
    let speed = 0.45 - (depth * 0.0004);
    if (speed < 0.05) speed = 0.05;
    return speed.toFixed(2) + ' m/s';
  },
  
  getConfidence: (depth) => {
    if (depth < 200) return '94%';
    if (depth < 600) return '88%';
    return '82%';
  }
};
