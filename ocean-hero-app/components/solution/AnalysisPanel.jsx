'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ModelResultsProvider } from '@/data/ModelResultsProvider';

// The FastAPI live-prediction backend (backend/main.py). Not part of the
// Next.js app — must be running separately (uvicorn main:app --port 8000).
// Defaults to local dev; set NEXT_PUBLIC_LIVE_API_BASE (e.g. in Vercel's
// project env vars) to point at the real deployed backend in production.
const LIVE_API_BASE = process.env.NEXT_PUBLIC_LIVE_API_BASE || 'http://localhost:8000';

// Real depths from the trained model's output (identical across all 5
// demo points) — used as a fallback before a result has loaded.
const DEFAULT_DEPTHS_M = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000];

// surface_state carries 2 fields for Bay of Bengal points and 6 for
// Arabian Sea points — this renders whichever keys are actually present
// on the matched result, in a fixed display order.
// Hand-rolled, not Date/toLocaleDateString — this project has already hit a
// real server-vs-browser locale hydration mismatch once (see the /technology
// page's formatCount()); formatting "YYYY-MM-DD" from its own string parts
// sidesteps that class of bug entirely instead of risking it again.
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatArgoDate(isoDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate);
  if (!m) return isoDate;
  const [, year, month, day] = m;
  return `${MONTH_ABBR[parseInt(month, 10) - 1]} ${parseInt(day, 10)}, ${year}`;
}

const SURFACE_FIELDS = [
  { key: 'sst_c', label: 'SST', format: (v) => `${v.toFixed(2)}°C` },
  { key: 'ssh_m', label: 'SSH', format: (v) => `${v.toFixed(3)} m` },
  { key: 'sss_psu', label: 'SSS', format: (v) => `${v.toFixed(2)} PSU` },
  { key: 'mld_m', label: 'MLD', format: (v) => `${v.toFixed(1)} m` },
  { key: 'wind_stress_curl', label: 'WIND STRESS CURL', format: (v) => `${v.toExponential(2)} N/m³` },
  { key: 'eddy_vorticity', label: 'EDDY VORTICITY', format: (v) => `${v.toExponential(2)} 1/s` },
];

export default function AnalysisPanel({ depthIndex, setDepthIndex, isSurface, setIsSurface, selectedId, arbitraryPoint, restore, onShareState }) {
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // A clicked point with no historical file at all (not one of the 5 demo
  // points) — live prediction only, no HISTORICAL/LIVE toggle to show.
  const isArbitrary = selectedId === null && !!arbitraryPoint;

  // HISTORICAL / LIVE — which data source drives the shared visual slots
  // below. Live prediction state is separate and cached per point: toggling
  // back and forth never re-fetches, only switching points does.
  const [viewMode, setViewMode] = useState('historical');
  const [liveSteps, setLiveSteps] = useState([]);
  const [liveResult, setLiveResult] = useState(null);
  const [liveError, setLiveError] = useState(null);
  // A 429 from the backend's rate limit isn't a failure: it gets its own header.
  const [liveRateLimited, setLiveRateLimited] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const liveSourceRef = useRef(null);
  const isLive = isArbitrary || viewMode === 'live';

  useEffect(() => {
    if (selectedId === null) {
      // No historical file for an arbitrary point — nothing to fetch.
      setResult(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;
    async function fetchResult() {
      setIsLoading(true);
      await ModelResultsProvider.load();
      if (cancelled) return;
      setResult(ModelResultsProvider.getResultById(selectedId));
      setIsLoading(false);
    }
    fetchResult();
    return () => { cancelled = true; };
  }, [selectedId]);

  // A newly selected point always starts on HISTORICAL (or, for an
  // arbitrary point with no historical file, goes straight to LIVE and
  // fetches immediately), and cancels/clears any in-flight or cached live
  // request — live is always fresh per point, never carried over.
  useEffect(() => {
    liveSourceRef.current?.close();
    liveSourceRef.current = null;
    setLiveSteps([]);
    setLiveResult(null);
    setLiveError(null);
    setLiveRateLimited(false);
    setLiveLoading(false);

    if (selectedId === null && arbitraryPoint) {
      setViewMode('live');
      startLivePrediction(arbitraryPoint.lat, arbitraryPoint.lon);
    } else {
      setViewMode('historical');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, arbitraryPoint?.lat, arbitraryPoint?.lon]);

  // Close the connection if the panel unmounts mid-stream.
  useEffect(() => () => liveSourceRef.current?.close(), []);

  // "X real Argo floats reported in this region in the last 7 days" — a real
  // count from the real Argo index, for whichever region is currently being
  // viewed. Fetched once per region per page load (cached in a ref), never on
  // every render or every point change within the same region.
  const viewedRegionName = isArbitrary ? arbitraryPoint?.region : result?.location?.region;
  const viewedRegionKey = viewedRegionName === 'Arabian Sea' ? 'arabian_sea'
    : viewedRegionName === 'Bay of Bengal' ? 'bay_of_bengal' : null;
  const recentCountCache = useRef({});
  const [recentCount, setRecentCount] = useState({ key: null, data: null, failed: false });

  useEffect(() => {
    if (!viewedRegionKey) return;
    if (recentCountCache.current[viewedRegionKey]) {
      setRecentCount({ key: viewedRegionKey, data: recentCountCache.current[viewedRegionKey], failed: false });
      return;
    }
    let cancelled = false;
    setRecentCount({ key: viewedRegionKey, data: null, failed: false });
    fetch(`${LIVE_API_BASE}/api/recent-argo-count?region=${viewedRegionKey}`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data) => {
        recentCountCache.current[viewedRegionKey] = data;
        if (!cancelled) setRecentCount({ key: viewedRegionKey, data, failed: false });
      })
      .catch(() => { if (!cancelled) setRecentCount({ key: viewedRegionKey, data: null, failed: true }); });
    return () => { cancelled = true; };
  }, [viewedRegionKey]);

  function startLivePrediction(lat, lon) {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

    liveSourceRef.current?.close();
    setLiveSteps([]);
    setLiveResult(null);
    setLiveError(null);
    setLiveRateLimited(false);
    setLiveLoading(true);

    // Read the same SSE stream with fetch instead of EventSource: EventSource
    // can't see the HTTP status, so a backend rate limit (429) was
    // indistinguishable from the backend being down. The handle keeps the
    // .close() shape the rest of this component already uses.
    const controller = new AbortController();
    const source = { close: () => controller.abort() };
    liveSourceRef.current = source;

    let finished = false;
    const handleUpdate = (update) => {
      if (update.step === 'error' || update.done) finished = true;
      if (update.step === 'error') {
        setLiveError(update.error || 'Live prediction failed.');
        setLiveLoading(false);
        source.close();
      } else if (update.done) {
        setLiveResult(update.result);
        setLiveLoading(false);
        source.close();
      } else {
        setLiveSteps((prev) => [...prev, update.step]);
      }
    };

    (async () => {
      try {
        const res = await fetch(`${LIVE_API_BASE}/api/live-predict/stream?lat=${lat}&lon=${lon}`, { signal: controller.signal });
        if (res.status === 429) {
          const wait = parseInt(res.headers.get('Retry-After'), 10);
          setLiveRateLimited(true);
          setLiveError(`You're making requests too quickly. Please wait${Number.isFinite(wait) ? ` ${wait} second${wait === 1 ? '' : 's'}` : ' a moment'} before trying again.`);
          setLiveLoading(false);
          return;
        }
        if (!res.ok || !res.body) {
          setLiveError(`The live prediction service returned an error (HTTP ${res.status}).`);
          setLiveLoading(false);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const messages = buffer.split('\n\n');
          buffer = messages.pop();
          for (const msg of messages) {
            if (msg.startsWith('data: ')) handleUpdate(JSON.parse(msg.slice(6))); // ": keep-alive" comments are skipped
          }
        }
        if (!finished) throw new Error('stream ended early');
      } catch (err) {
        if (err.name === 'AbortError') return; // closed on purpose (new point, or finished)
        setLiveError('Could not reach the live prediction service. Please check your connection and try again in a moment.');
        setLiveLoading(false);
      }
    })();
  }

  // Clicking LIVE only triggers a fetch the first time (or to retry after an
  // error) for this point — a cached liveResult means re-toggling is instant.
  // (Only reachable for a known point — arbitrary points skip the toggle
  // entirely and fetch immediately via the point-change effect above.)
  function handleTabClick(mode) {
    setViewMode(mode);
    if (mode === 'live' && !liveResult && !liveLoading && result?.location) {
      startLivePrediction(result.location.lat, result.location.lon);
    }
  }

  // Exports the currently displayed real result (whichever tab is active) as
  // a CSV: location/date/mode, then one row per one of the model's 15 real
  // depths with the real predicted temperature and, where available, the
  // real Argo temperature. Built entirely from state already in this
  // component - no new fetch.
  function handleDownloadCsv() {
    const active = isLive ? liveResult : result;
    if (!active?.profile) return;
    const { location, profile } = active;
    // Live results carry per-variable fetch dates (data_dates), not one
    // top-level date — use the same "most recent real source date" already
    // shown in the LAST UPDATED line above, so the CSV matches the UI.
    const date = isLive ? liveMostRecentDate : active.date;
    const rows = [
      ['location_lat', location?.lat ?? ''],
      ['location_lon', location?.lon ?? ''],
      ['region', location?.region ?? ''],
      ['date', date ?? ''],
      ['mode', isLive ? 'live' : 'historical'],
      [],
      ['depth_m', 'predicted_temp_c', 'argo_temp_c'],
      ...profile.depths_m.map((d, i) => [
        d,
        profile.predicted_temp_c?.[i] ?? '',
        profile.argo_temp_c?.[i] ?? '',
      ]),
    ];
    const csv = rows.map((row) => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const safeRegion = (location?.region || 'oceanembed').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    a.href = url;
    a.download = `oceanembed-${safeRegion}-${date || 'prediction'}-${isLive ? 'live' : 'historical'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ---- Historical derivations ----
  const depthsM = result?.profile?.depths_m || DEFAULT_DEPTHS_M;
  const clampedDepthIndex = Math.min(depthIndex, depthsM.length - 1);
  const depthValueM = depthsM[clampedDepthIndex];

  const predictedTemp = result?.profile?.predicted_temp_c?.[clampedDepthIndex];
  const argoTemp = result?.profile?.argo_temp_c?.[clampedDepthIndex];
  const confidencePct = result?.profile?.confidence_pct?.[clampedDepthIndex];

  const presentSurfaceFields = result
    ? SURFACE_FIELDS.filter((f) => result.surface_state[f.key] !== undefined)
    : [];

  // Chart space: x from temperature, y from depth (0-1000m -> 0-40 in the
  // 100x40 viewBox). Both the predicted and Argo curves share this mapping
  // so they're directly comparable on the same axes.
  const toPoints = (depths, temps) =>
    depths.map((d, i) => `${(temps[i] - 5) * 4},${d * 0.04}`).join(' ');
  const predictedPoints = result ? toPoints(result.profile.depths_m, result.profile.predicted_temp_c) : '';
  const argoPoints = result ? toPoints(result.profile.depths_m, result.profile.argo_temp_c) : '';

  // ---- Live derivations — same chart math, no Argo curve: there isn't one ----
  const liveDepthsM = liveResult?.profile?.depths_m || DEFAULT_DEPTHS_M;
  const liveClampedDepthIndex = Math.min(depthIndex, liveDepthsM.length - 1);
  const livePredictedTemp = liveResult?.profile?.predicted_temp_c?.[liveClampedDepthIndex];
  const livePredictedPoints = liveResult ? toPoints(liveResult.profile.depths_m, liveResult.profile.predicted_temp_c) : '';
  const livePresentSurfaceFields = liveResult
    ? SURFACE_FIELDS.filter((f) => liveResult.surface_state[f.key] !== undefined)
    : [];
  // Show the single most recent real fetch date across the live variables
  // (they lag by different amounts — SST/SSH ~2 real days, SSS/MLD/curl can
  // lag more) rather than claiming a blanket "today".
  const liveMostRecentDate = liveResult?.data_dates
    ? Object.values(liveResult.data_dates).slice().sort().slice(-1)[0]
    : null;

  // "found" | "none_nearby" | "lookup_failed" — the backend always returns
  // one of these three so a network/lookup failure is never presented as a
  // confirmed "no float nearby" (they used to collapse to the same result).
  const argoContext = liveResult?.recent_argo_context;
  const argoStatus = argoContext?.status;

  // ---- Active values: whichever tab is selected drives these shared slots ----
  const activeDepthsM = isLive ? liveDepthsM : depthsM;
  const activeClampedDepthIndex = isLive ? liveClampedDepthIndex : clampedDepthIndex;
  const activeDepthValueM = activeDepthsM[activeClampedDepthIndex];
  const activePredictedTemp = isLive ? livePredictedTemp : predictedTemp;
  const activePredictedPoints = isLive ? livePredictedPoints : predictedPoints;
  const activeArgoPoints = isLive ? '' : argoPoints;
  const activeConfidencePct = isLive ? undefined : confidencePct;
  const activeSurfaceState = isLive ? liveResult?.surface_state : result?.surface_state;
  const activePresentSurfaceFields = isLive ? livePresentSurfaceFields : presentSurfaceFields;

  // Depth indicator: a horizontal line at the selected depth (y = depth * 0.04),
  // with a dot marking the active predicted curve at that depth.
  const trackerY = activeDepthValueM * 0.04;
  const trackerX = Number.isFinite(activePredictedTemp) ? (activePredictedTemp - 5) * 4 : 5;

  const activeSurfaceTemp = isLive ? liveResult?.surface_state?.sst_c : result?.surface_state?.sst_c;

  // ---- Shareable permalink (additive; the toggle/fetch logic above is only
  // CALLED here, never changed) ----
  // 1. Restoring a LIVE link for a known demo point: once that point's saved
  //    result has loaded, press LIVE exactly as a user would (a real, fresh
  //    live fetch). Arbitrary points already go live on their own.
  const pendingLiveRestoreRef = useRef(null);
  useEffect(() => {
    if (restore && restore.mode === 'live') pendingLiveRestoreRef.current = restore;
  }, [restore]);
  useEffect(() => {
    const r = pendingLiveRestoreRef.current;
    if (!r || isArbitrary || isLoading || !result?.location) return;
    if (Math.abs(result.location.lat - r.lat) > 2e-4 || Math.abs(result.location.lon - r.lon) > 2e-4) return;
    pendingLiveRestoreRef.current = null;
    handleTabClick('live');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, isLoading, restore, isArbitrary]);

  // 2. Report what is currently shown (location, mode, date) so the page can
  //    keep the URL in sync. Live date = the most recent real source date of
  //    the live result; absent while the live fetch is still running.
  useEffect(() => {
    if (!onShareState) return;
    if (isArbitrary) {
      onShareState({ lat: arbitraryPoint.lat, lon: arbitraryPoint.lon, mode: 'live', date: liveResult ? liveMostRecentDate : null });
      return;
    }
    if (isLoading || !result?.location) return;
    onShareState(isLive
      ? { lat: result.location.lat, lon: result.location.lon, mode: 'live', date: liveResult ? liveMostRecentDate : null }
      : { lat: result.location.lat, lon: result.location.lon, mode: 'historical', date: result.date });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isArbitrary, arbitraryPoint?.lat, arbitraryPoint?.lon, isLive, isLoading, result, liveResult, liveMostRecentDate]);

  const [linkCopied, setLinkCopied] = useState(false);
  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2200);
    } catch {
      window.prompt('Copy this link to the current result:', window.location.href);
    }
  }

  return (
    <div className="analysis-panel">

      {/* Historical / Live toggle — the primary mode switch. A newly
          selected point always starts here on HISTORICAL. An arbitrary
          (non-demo) point has no historical file at all, so there's only
          one mode — the toggle is replaced with an honest note instead. */}
      {isArbitrary ? (
        <div className="new-location-note">
          This is a new location — live prediction only. Our 5 highlighted points also include historical validation against real Argo measurements.
        </div>
      ) : (
        <div className="panel-mode-selector">
          <button
            className={!isLive ? "active" : ""}
            onClick={() => handleTabClick('historical')}
          >
            HISTORICAL
          </button>
          <button
            className={isLive ? "active" : ""}
            onClick={() => handleTabClick('live')}
            disabled={!result?.location}
          >
            LIVE
          </button>
        </div>
      )}

      {/* Surface / Under-surface — orthogonal to the tab above; applies to
          whichever tab (historical or live) is currently active. */}
      <div className="panel-mode-selector">
        <button
          className={isSurface ? "active" : ""}
          onClick={() => setIsSurface(true)}
        >
          SURFACE TEMPERATURE
        </button>
        <button
          className={!isSurface ? "active" : ""}
          onClick={() => setIsSurface(false)}
        >
          UNDER-SURFACE TEMP
        </button>
      </div>

      <div className="permalink-row">
        <button type="button" className="copy-link-btn" onClick={handleCopyLink}>
          {linkCopied ? 'LINK COPIED' : 'COPY LINK TO THIS RESULT'}
        </button>
      </div>

      <div className="panel-section">
        <div className="section-label">LOCATION</div>
        <div className="location-readout">
          {isArbitrary ? (
            <>
              <div className="loc-region">{arbitraryPoint.region}</div>
              <div className="loc-coords">
                {arbitraryPoint.lat >= 0 ? `${arbitraryPoint.lat.toFixed(2)}° N` : `${Math.abs(arbitraryPoint.lat).toFixed(2)}° S`} • {arbitraryPoint.lon >= 0 ? `${arbitraryPoint.lon.toFixed(2)}° E` : `${Math.abs(arbitraryPoint.lon).toFixed(2)}° W`}
              </div>
            </>
          ) : (
            <>
              <div className="loc-region">{result?.location?.region || (isLoading ? "LOADING…" : "—")}</div>
              {result?.location && (
                <div className="loc-coords">
                  {result.location.lat >= 0 ? `${result.location.lat}° N` : `${Math.abs(result.location.lat)}° S`} • {result.location.lon >= 0 ? `${result.location.lon}° E` : `${Math.abs(result.location.lon)}° W`}
                </div>
              )}
            </>
          )}
          {recentCount.key === viewedRegionKey && recentCount.data && (
            <div className="recent-floats">
              <i className="recent-floats-dot" />
              {recentCount.data.count} real Argo float{recentCount.data.count === 1 ? '' : 's'} reported in the {viewedRegionName} in the last {recentCount.data.window_days} days
            </div>
          )}
        </div>
      </div>

      <hr className="divider" />

      {/* Temperature Readout — same slots for both tabs, content swaps */}
      <div className="panel-section metrics-grid" style={{ marginBottom: '-1rem' }}>
         <div className="metric">
            <span className="m-label">TEMPERATURE</span>
            <div className="temp-main">
              {isLive ? (
                liveLoading ? "..." : (Number.isFinite(activePredictedTemp) ? `${activePredictedTemp.toFixed(2)}°C` : (liveError ? "—" : "..."))
              ) : (
                isLoading ? "..." : (
                  isSurface
                    ? (Number.isFinite(activeSurfaceTemp) ? `${activeSurfaceTemp.toFixed(2)}°C` : "UNAVAILABLE")
                    : (Number.isFinite(activePredictedTemp) ? `${activePredictedTemp.toFixed(2)}°C` : "UNAVAILABLE")
                )
              )}
            </div>
            {!isLive && !isLoading && !isSurface && Number.isFinite(argoTemp) && (
              <span className="metric-source">ARGO: {argoTemp.toFixed(2)}°C · CONFIDENCE: {confidencePct.toFixed(1)}%</span>
            )}
            {!isLive && !isLoading && isSurface && (
              <span className="metric-source">OCEANEMBED MODEL PREDICTION</span>
            )}
         </div>
         <div className="metric">
            <span className="m-label">DATE</span>
            <span className="m-val">
              {isLive
                ? (liveResult ? `LIVE — ${liveMostRecentDate}` : "—")
                : (result?.date || "—")}
            </span>
            {isLive && liveResult && liveMostRecentDate && (
              <span className="metric-source">LAST UPDATED: {formatArgoDate(liveMostRecentDate)} (latest real source data used)</span>
            )}
         </div>
      </div>

      <hr className="divider" />

      {/* Model Validation — historical shows real RMSE/Bias/Correlation;
          live shows the fetch-in-progress checklist, an error, or an
          honest "not yet validated" note in this same position. */}
      <div className="panel-section">
        <div className="section-label">MODEL VALIDATION (VS. ARGO)</div>
        {isLive ? (
          liveLoading ? (
            <ul className="live-steps">
              {liveSteps.map((step, i) => {
                const isLastStep = i === liveSteps.length - 1;
                return (
                  <li key={i} className={isLastStep ? 'active' : 'done'}>
                    <span className="live-step-icon" />
                    {step}
                  </li>
                );
              })}
            </ul>
          ) : liveError ? (
            <div className="live-error">{liveRateLimited ? 'PLEASE WAIT' : 'LIVE PREDICTION FAILED'} — {liveError}</div>
          ) : (
            <>
              <div className="live-info-note">Not yet validated against Argo — real Argo data for this date won&apos;t be available for several weeks.</div>

              {/* Honest supporting context only — a real, nearby, recent Argo
                  reading, never a validation of the live number above (different
                  exact date and location). Shown in all three real outcomes —
                  found, confirmed none nearby, or the lookup itself failing —
                  so "no float nearby" only ever appears when that's actually
                  true, not whenever a network call happened to fail. */}
              <div className={`argo-context-note ${argoStatus === 'found' ? '' : 'argo-context-note-empty'}`}>
                <div className="argo-context-label">NEARBY RECENT ARGO READING</div>
                {argoStatus === 'found' ? (
                  <div className="argo-context-body">
                    {argoContext.surface_temp_c.toFixed(1)}°C — real float measurement from{' '}
                    {formatArgoDate(argoContext.date)} ({argoContext.days_ago}{' '}
                    day{argoContext.days_ago === 1 ? '' : 's'} ago), ~
                    {Math.round(argoContext.distance_km)}km away
                  </div>
                ) : argoStatus === 'lookup_failed' ? (
                  <div className="argo-context-body">Could not check for nearby Argo floats right now (network issue) — this is not a confirmed absence, just an unavailable lookup.</div>
                ) : (
                  <div className="argo-context-body">No real Argo float has reported within 30 days near this location.</div>
                )}
                <div className="argo-context-caption">For reference only — not the same date or exact location as this prediction.</div>
              </div>
            </>
          )
        ) : (
          <div className="metrics-grid">
            <div className="metric">
              <span className="m-label">RMSE</span>
              <span className="m-val">{result ? `${result.metrics.rmse_c.toFixed(3)}°C` : "—"}</span>
            </div>
            <div className="metric">
              <span className="m-label">BIAS</span>
              <span className="m-val">{result ? `${result.metrics.bias_c.toFixed(3)}°C` : "—"}</span>
            </div>
            <div className="metric">
              <span className="m-label">CORRELATION</span>
              <span className="m-val">{result ? result.metrics.correlation.toFixed(3) : "—"}</span>
            </div>
          </div>
        )}
      </div>

      {isSurface && activePresentSurfaceFields.length > 0 && (
        <>
          <hr className="divider" />
          <div className="panel-section">
            <div className="section-label">SURFACE STATE</div>
            <div className="metrics-grid">
              {activePresentSurfaceFields.map((f) => (
                <div className="metric" key={f.key}>
                  <span className="m-label">{f.label}</span>
                  <span className="m-val">{f.format(activeSurfaceState[f.key])}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {!isSurface && (
        <>
          <hr className="divider" />

          {/* Temperature Profile SVG — same chart, same slot; live shows a
              single predicted-only line, no dashed Argo curve. */}
          <div className="panel-section">
            <div className="section-label">PROFILE (0–1000m)</div>
            <div className="profile-chart">
               <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="chart-svg">
                  {/* Grid lines */}
                  <line x1="0" y1="10" x2="100" y2="10" stroke="#15799e" strokeWidth="0.2" opacity="0.3" />
                  <line x1="0" y1="20" x2="100" y2="20" stroke="#15799e" strokeWidth="0.2" opacity="0.3" />
                  <line x1="0" y1="30" x2="100" y2="30" stroke="#15799e" strokeWidth="0.2" opacity="0.3" />

                  {activePredictedPoints ? (
                     <polyline points={activePredictedPoints} fill="none" stroke="#7ce0d0" strokeWidth="1.5" />
                  ) : (
                     <path d="M 5 0 Q 35 15, 65 30 T 95 40" fill="none" stroke="rgba(124, 224, 208, 0.3)" strokeWidth="1.5" strokeDasharray="2 2" />
                  )}
                  {activeArgoPoints && (
                     <polyline points={activeArgoPoints} fill="none" stroke="#e28c31" strokeWidth="1.2" strokeDasharray="2 1.5" />
                  )}

                  {/* Selected-depth indicator (horizontal — this chart's y-axis is depth) */}
                  <line x1="0" y1={trackerY} x2="100" y2={trackerY} stroke="#fff" strokeWidth="0.4" strokeDasharray="1 1" opacity="0.6" />
                  <circle cx={trackerX} cy={trackerY} r="2" fill="#fff" />
               </svg>
            </div>
            <div className="profile-legend">
              {isLive ? (
                <span><i className="legend-swatch predicted" /> LIVE PREDICTED (NO ARGO YET)</span>
              ) : (
                <>
                  <span><i className="legend-swatch predicted" /> PREDICTED</span>
                  <span><i className="legend-swatch argo" /> ARGO (GROUND TRUTH)</span>
                </>
              )}
            </div>
            <button type="button" className="csv-download-btn" onClick={handleDownloadCsv}>
              DOWNLOAD AS CSV
            </button>
          </div>
        </>
      )}

      <hr className="divider" />

      {/* Depth Selector or Origin Label */}
      <div className="panel-section">
        {isSurface ? (
          <div className="surface-info-block">
             <div className="section-label">MODEL OUTPUT</div>
             <div className="sensor-source">OCEANEMBED PREDICTION</div>
             <div className="source-desc">
               {isLive
                 ? "This is the trained OceanEmbed model's live prediction from today's real satellite data — not yet compared against Argo."
                 : "This is the trained OceanEmbed model's validated output for this point, compared against a held-out Argo float profile."}
             </div>
          </div>
        ) : (
          <>
            <div className="section-row">
              <div className="section-label">DEPTH</div>
              <div className="slider-value">{activeDepthValueM}m <span>{Number.isFinite(activeConfidencePct) ? `CONFIDENCE: ${activeConfidencePct.toFixed(1)}%` : ''}</span></div>
            </div>

            <div className="slider-wrapper">
              <span className="bound">{activeDepthsM[0]}m</span>
              <input
                type="range"
                min="0" max={activeDepthsM.length - 1} step="1"
                value={activeClampedDepthIndex}
                onChange={(e) => setDepthIndex(Number(e.target.value))}
                className="depth-range"
              />
              <span className="bound">{activeDepthsM[activeDepthsM.length - 1]}m</span>
            </div>
          </>
        )}
      </div>

      <style>{`
        .analysis-panel {
          background: rgba(4, 21, 38, 0.4);
          border: 1px solid rgba(120, 203, 233, 0.15);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-radius: 4px;
          padding: 1.25rem 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
          height: 100%;
        }

        .panel-mode-selector {
          display: flex;
          gap: 1rem;
          margin-bottom: 0.5rem;
        }

        .permalink-row { display: flex; }
        .copy-link-btn {
          background: rgba(120, 203, 233, 0.08);
          border: 1px solid rgba(120, 203, 233, 0.3);
          color: #78CBE9;
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: 0.58rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          padding: 0.4rem 0.7rem;
          border-radius: 2px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .copy-link-btn:hover { background: rgba(120, 203, 233, 0.18); color: #fff; }

        .csv-download-btn {
          margin-top: 0.7rem;
          align-self: flex-start;
          background: rgba(120, 203, 233, 0.08);
          border: 1px solid rgba(120, 203, 233, 0.3);
          color: #78CBE9;
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: 0.6rem;
          font-weight: 600;
          letter-spacing: 0.06em;
          padding: 0.45rem 0.75rem;
          border-radius: 2px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .csv-download-btn:hover {
          background: rgba(120, 203, 233, 0.18);
          color: #fff;
        }

        .panel-mode-selector button {
          flex: 1;
          background: rgba(1, 7, 14, 0.6);
          border: 1px solid rgba(120, 203, 233, 0.1);
          color: rgba(238, 250, 255, 0.6);
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: 0.65rem;
          font-weight: 600;
          letter-spacing: 0.05em;
          padding: 0.5rem;
          cursor: pointer;
          transition: all 0.2s ease;
          border-radius: 2px;
        }

        .panel-mode-selector button:hover:not(:disabled) {
          color: #fff;
          border-color: rgba(120, 203, 233, 0.3);
        }

        .panel-mode-selector button.active {
          background: rgba(120, 203, 233, 0.1);
          border-color: #7ce0d0;
          color: #fff;
        }

        .panel-mode-selector button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .panel-section {
          display: flex;
          flex-direction: column;
          gap: 0.3rem;
        }

        .section-label {
          font-size: 0.7rem;
          letter-spacing: 0.1em;
          color: #78CBE9;
          font-weight: 500;
          opacity: 0.8;
        }

        .location-readout {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .loc-region {
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: 1.15rem;
          color: #fff;
          font-weight: 500;
        }

        .loc-coords {
          font-family: var(--font-public-sans), sans-serif;
          font-size: 0.75rem;
          color: #7ce0d0;
          letter-spacing: 0.05em;
        }

        .recent-floats {
          margin-top: 0.35rem;
          display: flex;
          align-items: center;
          gap: 0.45rem;
          font-size: 0.66rem;
          line-height: 1.4;
          color: rgba(238, 250, 255, 0.7);
        }

        .recent-floats-dot {
          flex: 0 0 auto;
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: #e28c31;
          box-shadow: 0 0 8px rgba(226, 140, 49, 0.7);
        }

        .temp-readout {
          display: flex;
          align-items: baseline;
          gap: 1.5rem;
        }

        .temp-main {
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: 2.2rem;
          font-weight: 600;
          line-height: 1;
          color: #fff;
          text-shadow: 0 0 20px rgba(124, 224, 208, 0.3);
        }

        .temp-anomaly {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }

        .anomaly-val {
          font-size: 1.1rem;
          font-weight: 600;
          color: #e28c31; /* warm indicator */
        }

        .anomaly-lbl {
          font-size: 0.6rem;
          letter-spacing: 0.05em;
          opacity: 0.6;
        }

        .divider {
          border: 0;
          height: 1px;
          background: rgba(120, 203, 233, 0.15);
          margin: 0.5rem 0;
        }

        .section-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
        }

        .slider-value {
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: 1.1rem;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 0.7rem;
        }

        .slider-value span {
          font-family: var(--font-public-sans), sans-serif;
          font-size: 0.75rem;
          font-weight: 400;
          opacity: 0.6;
        }

        .slider-wrapper {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .bound {
          font-size: 0.7rem;
          opacity: 0.6;
        }

        .depth-range {
          flex: 1;
          appearance: none;
          height: 2px;
          background: rgba(120, 203, 233, 0.3);
          border-radius: 2px;
          outline: none;
        }

        .depth-range::-webkit-slider-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #7ce0d0;
          cursor: grab;
          box-shadow: 0 0 10px rgba(124, 224, 208, 0.4);
        }

        .depth-range::-webkit-slider-thumb:active {
          cursor: grabbing;
        }

        .metric-source {
          color: rgba(124, 224, 208, 0.78);
          font-size: 0.62rem;
          letter-spacing: 0.04em;
          line-height: 1.35;
        }

        .surface-info-block {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          padding: 1rem 0;
        }

        .sensor-source {
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: 1.1rem;
          color: #7ce0d0;
          font-weight: 500;
        }

        .source-desc {
          font-size: 0.75rem;
          line-height: 1.4;
          color: rgba(238, 250, 255, 0.6);
        }

        .profile-chart {
          width: 100%;
          height: 80px;
          background: rgba(1, 7, 14, 0.3);
          border: 1px solid rgba(120, 203, 233, 0.05);
          border-radius: 2px;
          position: relative;
        }

        .chart-svg {
          width: 100%;
          height: 100%;
          display: block;
        }

        .profile-legend {
          display: flex;
          gap: 1rem;
          margin-top: 0.4rem;
        }

        .profile-legend span {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.6rem;
          letter-spacing: 0.05em;
          color: rgba(238, 250, 255, 0.65);
        }

        .legend-swatch {
          display: inline-block;
          width: 10px;
          height: 2px;
          border-radius: 1px;
        }

        .legend-swatch.predicted {
          background: #7ce0d0;
        }

        .legend-swatch.argo {
          background: #e28c31;
        }

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
        }

        .metric {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }

        .m-label {
          font-size: 0.65rem;
          letter-spacing: 0.05em;
          color: #78CBE9;
          opacity: 0.7;
        }

        .m-val {
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: 1rem;
          font-weight: 500;
        }

        .live-steps {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }

        .live-steps li {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          font-size: 0.72rem;
          color: rgba(238, 250, 255, 0.45);
          transition: color 0.2s ease;
        }

        .live-steps li.done,
        .live-steps li.active {
          color: rgba(238, 250, 255, 0.9);
        }

        .live-step-icon {
          flex: 0 0 auto;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.6rem;
          line-height: 1;
        }

        .live-steps li.done .live-step-icon {
          background: #7ce0d0;
          color: #01070e;
        }

        .live-steps li.done .live-step-icon::before {
          content: "✓";
        }

        .live-steps li.active .live-step-icon {
          border: 2px solid rgba(120, 203, 233, 0.3);
          border-top-color: #7ce0d0;
          animation: liveSpin 0.8s linear infinite;
        }

        @keyframes liveSpin {
          to { transform: rotate(360deg); }
        }

        .live-error {
          padding: 0.6rem 0.7rem;
          background: rgba(226, 140, 49, 0.1);
          border: 1px solid rgba(226, 140, 49, 0.35);
          color: #e28c31;
          font-size: 0.72rem;
          line-height: 1.5;
          border-radius: 2px;
        }

        .live-info-note {
          padding: 0.6rem 0.7rem;
          background: rgba(120, 203, 233, 0.08);
          border: 1px solid rgba(120, 203, 233, 0.25);
          color: rgba(238, 250, 255, 0.75);
          font-size: 0.72rem;
          line-height: 1.5;
          border-radius: 2px;
        }

        .argo-context-note {
          margin-top: 0.5rem;
          padding: 0.6rem 0.7rem;
          background: rgba(124, 224, 208, 0.07);
          border: 1px solid rgba(124, 224, 208, 0.3);
          border-radius: 2px;
        }

        .argo-context-note-empty {
          background: rgba(238, 250, 255, 0.04);
          border: 1px solid rgba(238, 250, 255, 0.14);
        }

        .argo-context-label {
          font-size: 0.62rem;
          letter-spacing: 0.1em;
          color: #7ce0d0;
          font-weight: 500;
          opacity: 0.85;
          margin-bottom: 0.35rem;
        }

        .argo-context-note-empty .argo-context-label {
          color: rgba(238, 250, 255, 0.5);
        }

        .argo-context-body {
          color: rgba(238, 250, 255, 0.85);
          font-size: 0.72rem;
          line-height: 1.5;
        }

        .argo-context-caption {
          margin-top: 0.35rem;
          color: rgba(238, 250, 255, 0.4);
          font-size: 0.64rem;
          font-style: italic;
          line-height: 1.4;
        }

        .new-location-note {
          padding: 0.6rem 0.7rem;
          margin-bottom: 0.5rem;
          background: rgba(226, 140, 49, 0.08);
          border: 1px solid rgba(226, 140, 49, 0.3);
          color: rgba(238, 250, 255, 0.8);
          font-size: 0.7rem;
          line-height: 1.5;
          border-radius: 2px;
        }
      `}</style>
    </div>
  );
}
