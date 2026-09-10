// data/solutionData.js

export const solutionData = {
  // Mock function to determine temperature profile based on depth and surface mode
  getTemperatureAtDepth: (depth, isSurface) => {
    // Basic scientific model: warmest at surface, rapidly cooling through thermocline 
    if (isSurface) {
      if (depth === 0) return { temp: 24.7, anomaly: '+1.2', source: 'Satellite Observations' };
      if (depth < 100) return { temp: 23.4, anomaly: '+0.8', source: 'Satellite & Argo Field' };
      if (depth < 400) return { temp: 18.2, anomaly: '+0.4', source: 'Model Reconstruction' };
      if (depth < 800) return { temp: 8.5, anomaly: '+0.1', source: 'Deep Interpolation' };
      return { temp: 4.2, anomaly: '0.0', source: 'Deep Water Extrapolation' };
    } else {
      // Under-surface context focuses specifically on reconstructed models starting lower
      if (depth === 0) return { temp: 21.0, anomaly: '-0.4', source: 'Model Reference baseline' };
      if (depth < 100) return { temp: 19.8, anomaly: '-0.3', source: 'Model Reconstruction' };
      if (depth < 400) return { temp: 15.5, anomaly: '-0.1', source: 'Deep Model Base' };
      if (depth < 800) return { temp: 6.8, anomaly: '0.0', source: 'Deep Interpolation' };
      return { temp: 3.5, anomaly: '0.0', source: 'Abyssal Reference' };
    }
  },

  getSecondaryMetrics: (depth) => {
    if (depth < 200) return { salinity: '35.1 PSU', current: '0.42 m/s', confidence: '92%' };
    if (depth < 600) return { salinity: '34.8 PSU', current: '0.18 m/s', confidence: '84%' };
    return { salinity: '34.6 PSU', current: '0.05 m/s', confidence: '78%' };
  }
};
