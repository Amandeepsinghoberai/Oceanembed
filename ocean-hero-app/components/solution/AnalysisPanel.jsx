'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ModelResultsProvider } from '@/data/ModelResultsProvider';

// The FastAPI live-prediction backend (backend/main.py). Not part of the
// Next.js app — must be running separately (uvicorn main:app --port 8000).
const LIVE_API_BASE = 'http://localhost:8000';

// Real depths from the trained model's output (identical across all 5
// demo points) — used as a fallback before a result has loaded.
const DEFAULT_DEPTHS_M = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000];

// surface_state carries 2 fields for Bay of Bengal points and 6 for
// Arabian Sea points — this renders whichever keys are actually present
// on the matched result, in a fixed display order.
const SURFACE_FIELDS = [
  { key: 'sst_c', label: 'SST', format: (v) => `${v.toFixed(2)}°C` },
  { key: 'ssh_m', label: 'SSH', format: (v) => `${v.toFixed(3)} m` },
  { key: 'sss_psu', label: 'SSS', format: (v) => `${v.toFixed(2)} PSU` },
  { key: 'mld_m', label: 'MLD', format: (v) => `${v.toFixed(1)} m` },
  { key: 'wind_stress_curl', label: 'WIND STRESS CURL', format: (v) => `${v.toExponential(2)} N/m³` },
  { key: 'eddy_vorticity', label: 'EDDY VORTICITY', format: (v) => `${v.toExponential(2)} 1/s` },
];

export default function AnalysisPanel({ depthIndex, setDepthIndex, isSurface, setIsSurface, selectedId }) {
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // HISTORICAL / LIVE — which data source drives the shared visual slots
  // below. Live prediction state is separate and cached per point: toggling
  // back and forth never re-fetches, only switching points does.
  const [viewMode, setViewMode] = useState('historical');
  const [liveSteps, setLiveSteps] = useState([]);
  const [liveResult, setLiveResult] = useState(null);
  const [liveError, setLiveError] = useState(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const liveSourceRef = useRef(null);
  const isLive = viewMode === 'live';

  useEffect(() => {
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

  // A newly selected point always starts on HISTORICAL, and cancels/clears
  // any in-flight or cached live request — live is always a fresh, explicit
  // action per point, never carried over from the previous one.
  useEffect(() => {
    setViewMode('historical');
    liveSourceRef.current?.close();
    liveSourceRef.current = null;
    setLiveSteps([]);
    setLiveResult(null);
    setLiveError(null);
    setLiveLoading(false);
  }, [selectedId]);

  // Close the connection if the panel unmounts mid-stream.
  useEffect(() => () => liveSourceRef.current?.close(), []);

  function startLivePrediction() {
    if (!result?.location) return;
    const { lat, lon } = result.location;

    liveSourceRef.current?.close();
    setLiveSteps([]);
    setLiveResult(null);
    setLiveError(null);
    setLiveLoading(true);

    const source = new EventSource(`${LIVE_API_BASE}/api/live-predict/stream?lat=${lat}&lon=${lon}`);
    liveSourceRef.current = source;

    source.onmessage = (event) => {
      const update = JSON.parse(event.data);
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

    source.onerror = () => {
      setLiveError('Could not reach the live prediction service. Is the backend running on localhost:8000?');
      setLiveLoading(false);
      source.close();
    };
  }

  // Clicking LIVE only triggers a fetch the first time (or to retry after an
  // error) for this point — a cached liveResult means re-toggling is instant.
  function handleTabClick(mode) {
    setViewMode(mode);
    if (mode === 'live' && !liveResult && !liveLoading) {
      startLivePrediction();
    }
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

  return (
    <div className="analysis-panel">

      {/* Historical / Live toggle — the primary mode switch. A newly
          selected point always starts here on HISTORICAL. */}
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

      <div className="panel-section">
        <div className="section-label">LOCATION</div>
        <div className="location-readout">
          <div className="loc-region">{result?.location?.region || (isLoading ? "LOADING…" : "—")}</div>
          {result?.location && (
            <div className="loc-coords">
              {result.location.lat >= 0 ? `${result.location.lat}° N` : `${Math.abs(result.location.lat)}° S`} • {result.location.lon >= 0 ? `${result.location.lon}° E` : `${Math.abs(result.location.lon)}° W`}
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
            <div className="live-error">LIVE PREDICTION FAILED — {liveError}</div>
          ) : (
            <div className="live-info-note">Not yet validated against Argo — real Argo data for this date won&apos;t be available for several weeks.</div>
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
      `}</style>
    </div>
  );
}
