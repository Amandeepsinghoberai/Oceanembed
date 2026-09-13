// The one real, normalized ocean-state endpoint all 4 Intelligence modules
// consume (backend/main.py's /api/ocean-state) — replaces the 5 dead
// Real*DataProvider.js singletons that used to hit local static files
// (copernicus_*.meta.json, hycom_*.meta.json, etc.) that were intentionally
// deleted from this project months ago and never existed in this handoff.
//
// A plain async function, not a stateful singleton class — there's no
// binary-grid/caching semantics to manage here, just one real fetch per
// requested point. Real fetches take 5-90 seconds (same live network calls
// as /api/live-predict/stream), so callers must show a real loading state.
const LIVE_API_BASE = 'http://localhost:8000';

export async function fetchOceanState(lat, lon) {
  const res = await fetch(`${LIVE_API_BASE}/api/ocean-state?lat=${lat}&lon=${lon}`);
  if (!res.ok) throw new Error(`ocean-state error: HTTP ${res.status}`);
  return res.json();
}
