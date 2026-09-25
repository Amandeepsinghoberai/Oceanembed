// Shareable permalinks for the Solution page.
//
// URL shape:  /solution?lat=13.14&lon=86.75&mode=historical&date=2023-01-26
//   lat, lon : the result's location (a demo point's exact coordinates, or a
//              clicked point rounded to 4 decimals)
//   mode     : "historical" | "live"
//   date     : the date of the result shown. Historical: the saved result's
//              date. Live: the most recent real source-data date of the live
//              result (omitted while a live fetch is still in flight).
//
// Loading a link restores the SAME real result: a demo point re-loads its
// saved historical result from its file; a live link starts a fresh real live
// fetch (live results are a snapshot of the moment they're fetched, so `date`
// on a live link records what was shared and is shown to the visitor, it is
// not something a fresh fetch can reproduce).

// Real model coverage - must match backend/live_predict.py's _classify_region
// and RealOceanMap.jsx's classifyRegion (the 77-80E gap belongs to neither).
export function classifyPermalinkRegion(lat, lon) {
  if (lat < 5 || lat > 30) return null;
  if (lon >= 45 && lon < 77) return 'Arabian Sea';
  if (lon >= 80 && lon <= 100) return 'Bay of Bengal';
  return null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Returns { lat, lon, mode, date } or null if the URL carries no (valid)
// permalink. Never guesses: a missing/invalid lat or lon means no restore.
export function parsePermalink(search) {
  const q = new URLSearchParams(search);
  if (!q.has('lat') || !q.has('lon')) return null;
  const lat = Number(q.get('lat'));
  const lon = Number(q.get('lon'));
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
  const modeParam = q.get('mode');
  const mode = modeParam === 'live' ? 'live' : modeParam === 'historical' ? 'historical' : null;
  const date = DATE_RE.test(q.get('date') || '') ? q.get('date') : null;
  return { lat, lon, mode, date };
}

const round4 = (n) => Math.round(n * 1e4) / 1e4;

// The current page URL with the permalink params set (other params, e.g.
// openCalendar, are left alone).
export function buildPermalinkUrl(href, { lat, lon, mode, date }) {
  const url = new URL(href);
  url.searchParams.set('lat', String(round4(lat)));
  url.searchParams.set('lon', String(round4(lon)));
  url.searchParams.set('mode', mode);
  if (date) url.searchParams.set('date', date); else url.searchParams.delete('date');
  return url.toString();
}

export const sameSpot = (a, b) => Math.abs(a.lat - b.lat) < 2e-4 && Math.abs(a.lon - b.lon) < 2e-4;
