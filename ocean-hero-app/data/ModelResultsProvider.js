// data/ModelResultsProvider.js
//
// Loads the 5 real, validated outputs of the trained OceanEmbed model
// (public/data/demo_1.json .. demo_5.json) and lets components look one
// up. This is the ONLY data source for anything shown as "our model's
// prediction" in the app — no live/raw fetches, no fallbacks.

const FILES = ['demo_1.json', 'demo_2.json', 'demo_3.json', 'demo_4.json', 'demo_5.json'];

class ModelResultsProviderClass {
  constructor() {
    this.results = [];
    this.isLoaded = false;
    this._loadPromise = null;
  }

  async load() {
    if (this.isLoaded) return;
    if (this._loadPromise) return this._loadPromise;

    this._loadPromise = (async () => {
      try {
        const loaded = await Promise.all(
          FILES.map(f => fetch(`/data/${f}`).then(r => {
            if (!r.ok) throw new Error(`Failed to load ${f}: ${r.status}`);
            return r.json();
          }))
        );
        // Attach a stable id (its index) to each result so components can
        // look it up without relying on float equality on lat/lon/date.
        this.results = loaded.map((r, id) => ({ id, ...r }));
        this.isLoaded = true;
      } catch (e) {
        console.error('Failed to load model results:', e);
      }
    })();

    return this._loadPromise;
  }

  getAllLocations() {
    return this.results.map(r => ({
      id: r.id,
      lat: r.location.lat,
      lon: r.location.lon,
      region: r.location.region,
      date: r.date
    }));
  }

  /** Look up a result by its stable id (preferred — see getAllLocations()). */
  getResultById(id) {
    return this.results.find(r => r.id === id) || null;
  }

  /** Kept for compatibility with the exact-match lookup described in the brief. */
  getResult(lat, lon, date) {
    return this.results.find(r => r.location.lat === lat && r.location.lon === lon && r.date === date) || null;
  }
}

export const ModelResultsProvider = new ModelResultsProviderClass();
