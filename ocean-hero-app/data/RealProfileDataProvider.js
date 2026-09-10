// data/RealProfileDataProvider.js

class RealProfileDataProviderClass {
  constructor() {
    this.data = null;
    this.isLoaded = false;
  }

  async load() {
    if (this.isLoaded) return;
    
    try {
      const res = await fetch('/data/profile/hycom_profile_2026-08-31.json');
      if (!res.ok) throw new Error(`Profile data error! status: ${res.status}`);
      const data = await res.json();

      this.data = data;
      this.isLoaded = true;
    } catch (e) {
      console.error("Failed to load real profile data:", e);
    }
  }

  getProfile(lat, lon) {
    if (!this.isLoaded || !this.data) return null;
    
    // For this specific iteration, we only have data exported exactly near 15N 65E
    // We enforce an approximate geographic bound check simulating the sub-region.
    if (Math.abs(lat - 15.0) < 5.0 && Math.abs(lon - 65.0) < 5.0) {
      return {
        depths: this.data.depths,
        temperatures: this.data.temperatures,
        source: this.data.source,
        timestamp: this.data.timestamp,
        lat: this.data.latitude,
        lon: this.data.longitude
      };
    }
    
    return null; // Return null if outside explicitly available bounds
  }

  getTemperatureAtDepth(lat, lon, targetDepth) {
     const profile = this.getProfile(lat, lon);
     if (!profile) return null;
     
     // Find exactly nearest valid depth
     let nearestIdx = 0;
     let minDiff = Math.abs(profile.depths[0] - targetDepth);
     for (let i = 1; i < profile.depths.length; i++) {
        let diff = Math.abs(profile.depths[i] - targetDepth);
        if (diff < minDiff) {
            minDiff = diff;
            nearestIdx = i;
        }
     }
     
     return {
       temperature: profile.temperatures[nearestIdx],
       actualDepth: profile.depths[nearestIdx],
       source: profile.source,
       timestamp: profile.timestamp
     };
  }
}

export const RealProfileDataProvider = new RealProfileDataProviderClass();
