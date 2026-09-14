'use client';

import React, { useState } from 'react';
import OceanLocationMap from './OceanLocationMap';
import LiveStepsList from './LiveStepsList';
import { useOceanState } from '@/lib/useOceanState';

export default function OceanHealthModule() {
  const [selectedLocation, setSelectedLocation] = useState({
    key: 'arabian-sea',
    lat: 15.0,
    lon: 64.96,
    regionName: 'Arabian Sea Core Region'
  });
  const [selectedDepthKey, setSelectedDepthKey] = useState('600-900');

  const presets = [
    { key: 'arabian-sea', name: 'Arabian Sea Core', lat: 15.0, lon: 64.96, regionName: 'Arabian Sea Core Region' },
    { key: 'bay-of-bengal', name: 'Bay of Bengal Basin', lat: 14.5, lon: 84.0, regionName: 'Bay of Bengal Basin' },
    { key: 'equatorial', name: 'Equatorial Sector', lat: -0.5, lon: 78.0, regionName: 'Equatorial Sector' }
  ];

  // Bands from the spec doc (section 6); targetDepth picks the nearest of
  // the model's own 15 fixed real depths to represent each band, since the
  // backend only ever returns values at those exact depths — never an
  // interpolated/invented in-between value.
  const depthConfig = {
    '0-200': { targetDepth: 100, label: '0 – 200 m (Surface & Mixed Layer)' },
    '200-600': { targetDepth: 400, label: '200 – 600 m (Thermocline Layer)' },
    '600-900': { targetDepth: 750, label: '600 – 900 m (Intermediate Subsurface)' },
    '900-1000': { targetDepth: 950, label: '900 – 1000 m (Deep Ocean Layer)' }
  };

  const activeDepth = depthConfig[selectedDepthKey];

  // Real live data — a single normalized /api/ocean-state stream, replacing
  // the 5 dead local-file providers. Real 5-90s network calls; `steps`
  // carries each real fetch's progress as it lands, same checklist the
  // Solution page's live mode shows, so loading visibly shows real work
  // happening instead of a single static "loading" label.
  const { steps, ocean, loadError, isLoading } = useOceanState(selectedLocation.lat, selectedLocation.lon);

  // Compute Anomaly & Condition Status
  let tempDisplay = 'DATA UNAVAILABLE';
  let tempAnomalyDisplay = 'DATA UNAVAILABLE';
  let tempAnomalyReference = 'REFERENCE UNAVAILABLE';
  let salinityDisplay = 'DATA UNAVAILABLE';
  let currentSpeedDisplay = 'DATA UNAVAILABLE';
  let currentDirDisplay = 'DATA UNAVAILABLE';

  let conditionStatus = 'INSUFFICIENT DATA';
  let statusClass = 'insufficient';
  let polylinePoints = '';

  // Plain-language "what this means" for each status class, so a
  // non-technical viewer understands what "anomaly" means here without
  // this module overclaiming a specific cause (per spec section 6 —
  // possible physical processes are hypotheses to investigate, not a
  // diagnosis).
  const STATUS_EXPLANATIONS = {
    normal: 'Temperature at this depth is close to the expected seasonal average for this location and time of year.',
    elevated: 'Temperature at this depth differs somewhat from the expected seasonal average — worth watching, not necessarily unusual.',
    unusual: 'Temperature at this depth differs significantly from the expected seasonal average, which could indicate an eddy, upwelling, water-mass movement, or a marine heat event. This flags a physical difference, not a confirmed cause.',
    insufficient: 'A real same-depth reference baseline isn’t available for this location, so no anomaly comparison can be shown honestly.',
  };

  if (!isLoading && ocean) {
    const { surface, subsurface, reference, derived } = ocean;

    // Nearest real depth to this band's representative target.
    const depthIndex = subsurface.depth_m.reduce((bestIdx, d, i) => (
      Math.abs(d - activeDepth.targetDepth) < Math.abs(subsurface.depth_m[bestIdx] - activeDepth.targetDepth) ? i : bestIdx
    ), 0);

    // Temperature & true same-depth anomaly (only when a real reference
    // exists at this exact depth — per the spec, a cross-depth comparison
    // must never be called a true anomaly, so there's no cross-depth
    // fallback here at all).
    if (subsurface.valid) {
      tempDisplay = `${subsurface.temperature_c[depthIndex].toFixed(1)} °C`;

      if (reference.same_depth && derived.temperature_anomaly_c && derived.temperature_anomaly_c[depthIndex] !== null) {
        const anomalyVal = derived.temperature_anomaly_c[depthIndex];
        const sign = anomalyVal >= 0 ? '+' : '';
        tempAnomalyDisplay = `${sign}${anomalyVal.toFixed(1)} °C`;
        tempAnomalyReference = 'VS GLORYS BASELINE (SAME DEPTH)';

        if (Math.abs(anomalyVal) > 1.2) {
          conditionStatus = 'UNUSUAL';
          statusClass = 'unusual';
        } else if (Math.abs(anomalyVal) > 0.5) {
          conditionStatus = 'ELEVATED';
          statusClass = 'elevated';
        } else {
          conditionStatus = 'NORMAL';
          statusClass = 'normal';
        }
      } else {
        tempAnomalyDisplay = 'DATA UNAVAILABLE';
        tempAnomalyReference = 'REFERENCE UNAVAILABLE';
        conditionStatus = 'INSUFFICIENT DATA';
        statusClass = 'insufficient';
      }
    } else {
      tempDisplay = 'DATA UNAVAILABLE';
      tempAnomalyDisplay = 'DATA UNAVAILABLE';
      conditionStatus = 'INSUFFICIENT DATA';
      statusClass = 'insufficient';
    }

    // Salinity
    if (surface.sss_psu !== null) {
      salinityDisplay = `${surface.sss_psu.toFixed(1)} PSU`;
    }

    // Current
    if (derived.current_speed_ms !== null) {
      currentSpeedDisplay = `${derived.current_speed_ms.toFixed(2)} m/s`;
      currentDirDisplay = `${derived.current_direction_deg}°`;
    }

    // Profile Polyline for SVG chart
    if (subsurface.valid) {
      const points = subsurface.depth_m.map((d, i) => {
        const t = subsurface.temperature_c[i];
        const x = 50 + ((t - 4) / 26) * 280;
        const y = 15 + (d / 1000) * 160;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      polylinePoints = points.join(' ');
    }
  }

  const activeSourcesList = ocean?.provenance || [];

  return (
    <article className="intel-card ocean-health-workstation">
      <div className="workstation-header">
        <h2>OCEAN HEALTH</h2>
        <p className="headline">Inspect unusual ocean conditions across the water column.</p>
      </div>

      <div className="workstation-grid">
        {/* LEFT COLUMN: MAP */}
        <div className="map-column">
          <OceanLocationMap
            mode="single"
            selectedLocation={selectedLocation}
            onLocationSelect={(loc) => setSelectedLocation(loc)}
            presets={presets}
            activePresetKey={selectedLocation?.key}
            onPresetSelect={(p) => setSelectedLocation(p)}
            title="LOCATION SELECTOR"
          />
        </div>

        {/* RIGHT COLUMN: ANALYSIS & CONTROL PANEL */}
        <div className="info-column">
          {/* SELECTED LOCATION */}
          <div className="panel-box location-box">
            <span className="box-label">SELECTED LOCATION</span>
            <div className="location-coords">
              <strong>
                {selectedLocation.lat >= 0 ? `${selectedLocation.lat.toFixed(2)}° N` : `${Math.abs(selectedLocation.lat).toFixed(2)}° S`}
                {' · '}
                {selectedLocation.lon >= 0 ? `${selectedLocation.lon.toFixed(2)}° E` : `${Math.abs(selectedLocation.lon).toFixed(2)}° W`}
              </strong>
              {selectedLocation.regionName && (
                <span className="region-tag">{selectedLocation.regionName}</span>
              )}
            </div>
          </div>

          {/* DEPTH SELECTOR */}
          <div className="panel-box depth-box">
            <span className="box-label">DEPTH LAYER</span>
            <div className="depth-segmented-control" role="tablist" aria-label="Subsurface Depth Layers">
              {Object.keys(depthConfig).map((key) => (
                <button
                  key={key}
                  role="tab"
                  aria-selected={selectedDepthKey === key}
                  className={`depth-btn ${selectedDepthKey === key ? 'active' : ''}`}
                  onClick={() => setSelectedDepthKey(key)}
                >
                  {key} m
                </button>
              ))}
            </div>
          </div>

          {/* OCEAN CONDITIONS */}
          <div className="panel-box conditions-box">
            <span className="box-label">OCEAN CONDITIONS ({selectedDepthKey} m)</span>
            <div className="metrics-grid">
              <div className="metric-card">
                <span className="metric-name">TEMPERATURE</span>
                <strong className="metric-val">{isLoading ? '...' : tempDisplay}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-name">SALINITY</span>
                <strong className="metric-val">{isLoading ? '...' : salinityDisplay}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-name">CURRENT SPEED</span>
                <strong className="metric-val">{isLoading ? '...' : currentSpeedDisplay}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-name">CURRENT DIRECTION</span>
                <strong className="metric-val">{isLoading ? '...' : currentDirDisplay}</strong>
              </div>
            </div>
          </div>

          {/* TEMPERATURE ANOMALY & CONDITION STATUS */}
          <div className="panel-box anomaly-box">
            <div className="anomaly-header">
              <div>
                <span className="box-label">TEMPERATURE ANOMALY</span>
                <span className="anomaly-ref">{tempAnomalyReference}</span>
              </div>
              <strong className="anomaly-val">{isLoading ? '...' : tempAnomalyDisplay}</strong>
            </div>

            <div className="status-row">
              <span className="box-label">OCEAN CONDITION</span>
              <span className={`status-badge ${loadError ? 'insufficient' : statusClass}`}>
                {isLoading ? 'LOADING LIVE DATA...' : loadError ? 'LIVE DATA UNAVAILABLE' : conditionStatus}
              </span>
            </div>
            {!isLoading && !loadError && (
              <p className="status-explainer">{STATUS_EXPLANATIONS[statusClass]}</p>
            )}
            {isLoading && <LiveStepsList steps={steps} />}
          </div>

          {/* THERMAL PROFILE GRAPH */}
          <div className="panel-box profile-box">
            <span className="box-label">THERMAL PROFILE (0–1000 m)</span>
            <div className="profile-chart">
              <svg viewBox="0 0 350 190" className="profile-svg">
                {/* Background Grid */}
                <rect width="350" height="190" fill="rgba(1, 9, 21, 0.7)" rx="3" stroke="rgba(120, 203, 233, 0.12)" />
                <line x1="50" y1="15" x2="50" y2="170" stroke="rgba(120, 203, 233, 0.2)" />
                <line x1="50" y1="170" x2="330" y2="170" stroke="rgba(120, 203, 233, 0.2)" />

                {/* Y-Axis Depth Markers */}
                <text x="42" y="20" textAnchor="end" fill="rgba(222,244,252,0.5)" fontSize="8">0m</text>
                <text x="42" y="55" textAnchor="end" fill="rgba(222,244,252,0.5)" fontSize="8">200m</text>
                <text x="42" y="100" textAnchor="end" fill="rgba(222,244,252,0.5)" fontSize="8">600m</text>
                <text x="42" y="145" textAnchor="end" fill="rgba(222,244,252,0.5)" fontSize="8">900m</text>
                <text x="42" y="170" textAnchor="end" fill="rgba(222,244,252,0.5)" fontSize="8">1000m</text>

                {/* X-Axis Temperature Markers */}
                <text x="50" y="184" fill="rgba(222,244,252,0.5)" fontSize="8">4°C</text>
                <text x="190" y="184" fill="rgba(222,244,252,0.5)" fontSize="8">17°C</text>
                <text x="330" y="184" fill="rgba(222,244,252,0.5)" textAnchor="end" fontSize="8">30°C</text>

                {/* Reference Baseline Curve */}
                <path d="M 310 15 Q 200 55, 130 100 T 80 170" fill="none" stroke="rgba(120, 203, 233, 0.35)" strokeWidth="1" strokeDasharray="3 3" />

                {/* Active Subsurface Profile Polyline */}
                {polylinePoints ? (
                  <polyline points={polylinePoints} fill="none" stroke="#7ce0d0" strokeWidth="2" />
                ) : (
                  <text x="190" y="95" textAnchor="middle" fill="rgba(222,244,252,0.5)" fontSize="8" fontStyle="italic">
                    DATA NOT AVAILABLE
                  </text>
                )}
              </svg>
            </div>
          </div>

          {/* POSSIBLE PHYSICAL PROCESSES */}
          <div className="panel-box processes-box">
            <span className="box-label">POSSIBLE PHYSICAL PROCESSES</span>
            <ul className="processes-list">
              <li>Water-mass movement / subduction</li>
              <li>Mesoscale eddy activity</li>
              <li>Vertical mixing / upwelling variability</li>
              <li>Marine heat events</li>
            </ul>
          </div>

          {/* DATA SOURCES */}
          <div className="sources-row">
            <span className="sources-label">DATA SOURCES</span>
            <span className="sources-list">
              {isLoading ? 'LOADING...' : loadError ? 'UNAVAILABLE' : activeSourcesList.length > 0 ? activeSourcesList.join(' · ') : 'NONE AVAILABLE'}
            </span>
          </div>

          {/* SCIENTIFIC DISCLAIMER */}
          <p className="scientific-disclaimer">
            Status reflects unusual physical ocean conditions and is not a biological ecosystem-health assessment.
          </p>
        </div>
      </div>

      <style>{`
        .ocean-health-workstation {
          background: rgba(3, 17, 36, 0.85);
          border: 1px solid rgba(120, 203, 233, 0.2);
          border-radius: 4px;
          padding: 1.5rem;
          margin-bottom: 2rem;
          backdrop-filter: blur(8px);
        }
        .workstation-header {
          margin-bottom: 1.2rem;
        }
        .workstation-header h2 {
          color: #fff;
          font: 700 1.6rem var(--font-space-grotesk), sans-serif;
          margin: 0 0 0.15rem 0;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .workstation-header .headline {
          color: rgba(222, 244, 252, 0.75);
          font: 500 0.9rem var(--font-public-sans), sans-serif;
          margin: 0;
        }
        .workstation-grid {
          display: grid;
          grid-template-columns: 1.15fr 1fr;
          gap: 1.2rem;
          align-items: start;
        }
        .map-column {
          width: 100%;
        }
        .info-column {
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
        }
        .panel-box {
          background: rgba(1, 9, 21, 0.65);
          border: 1px solid rgba(120, 203, 233, 0.15);
          padding: 0.85rem 1rem;
          border-radius: 3px;
        }
        .box-label {
          display: block;
          color: rgba(120, 203, 233, 0.65);
          font: 600 0.58rem var(--font-public-sans), sans-serif;
          letter-spacing: 0.12em;
          margin-bottom: 0.4rem;
        }
        .location-coords {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 0.5rem;
        }
        .location-coords strong {
          color: #fff;
          font: 700 1.15rem var(--font-space-grotesk), sans-serif;
          letter-spacing: -0.01em;
        }
        .region-tag {
          color: #7ce0d0;
          font: 600 0.68rem var(--font-space-grotesk), sans-serif;
          background: rgba(124, 224, 208, 0.12);
          border: 1px solid rgba(124, 224, 208, 0.25);
          padding: 0.15rem 0.4rem;
          border-radius: 2px;
        }
        .depth-segmented-control {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.35rem;
          background: rgba(8, 60, 97, 0.2);
          padding: 0.25rem;
          border-radius: 2px;
        }
        .depth-btn {
          background: transparent;
          border: 1px solid transparent;
          color: rgba(234, 247, 255, 0.75);
          font: 600 0.7rem var(--font-space-grotesk), sans-serif;
          padding: 0.35rem 0.2rem;
          border-radius: 2px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: center;
        }
        .depth-btn:hover {
          color: #fff;
          background: rgba(120, 203, 233, 0.1);
        }
        .depth-btn.active {
          background: rgba(124, 224, 208, 0.15);
          border-color: rgba(124, 224, 208, 0.4);
          color: #7ce0d0;
        }
        .metrics-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
        }
        .metric-card {
          background: rgba(8, 60, 97, 0.25);
          border: 1px solid rgba(120, 203, 233, 0.1);
          padding: 0.45rem 0.6rem;
          border-radius: 2px;
        }
        .metric-name {
          display: block;
          color: rgba(222, 244, 252, 0.55);
          font: 600 0.54rem var(--font-public-sans), sans-serif;
          letter-spacing: 0.08em;
          margin-bottom: 0.2rem;
        }
        .metric-val {
          display: block;
          color: #eaf7ff;
          font: 600 0.92rem var(--font-space-grotesk), sans-serif;
        }
        .anomaly-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: 0.6rem;
          margin-bottom: 0.6rem;
          border-bottom: 1px solid rgba(120, 203, 233, 0.12);
        }
        .anomaly-ref {
          display: block;
          color: rgba(222, 244, 252, 0.5);
          font: 600 0.54rem var(--font-public-sans), sans-serif;
          letter-spacing: 0.06em;
          margin-top: 0.1rem;
        }
        .anomaly-val {
          color: #7ce0d0;
          font: 700 1.4rem var(--font-space-grotesk), sans-serif;
        }
        .status-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .status-explainer {
          margin: 0.55rem 0 0 0;
          color: rgba(222, 244, 252, 0.65);
          font-size: 0.72rem;
          line-height: 1.45;
        }
        .status-badge {
          display: inline-block;
          font: 700 0.62rem var(--font-space-grotesk), sans-serif;
          letter-spacing: 0.1em;
          padding: 0.2rem 0.5rem;
          border-radius: 2px;
        }
        .status-badge.normal {
          background: rgba(124, 224, 208, 0.15);
          color: #7ce0d0;
          border: 1px solid rgba(124, 224, 208, 0.4);
        }
        .status-badge.elevated {
          background: rgba(243, 201, 139, 0.15);
          color: #f3c98b;
          border: 1px solid rgba(243, 201, 139, 0.4);
        }
        .status-badge.unusual {
          background: rgba(217, 83, 79, 0.15);
          color: #e06c69;
          border: 1px solid rgba(217, 83, 79, 0.4);
        }
        .status-badge.insufficient {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .profile-chart {
          width: 100%;
        }
        .profile-svg {
          width: 100%;
          max-height: 190px;
          height: auto;
          display: block;
        }
        .processes-list {
          margin: 0;
          padding-left: 1.1rem;
          color: rgba(222, 244, 252, 0.7);
          font-size: 0.78rem;
          line-height: 1.5;
        }
        .sources-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: rgba(1, 9, 21, 0.4);
          padding: 0.4rem 0.65rem;
          border-radius: 2px;
          border: 1px solid rgba(120, 203, 233, 0.1);
        }
        .sources-label {
          color: rgba(120, 203, 233, 0.55);
          font: 600 0.55rem var(--font-public-sans), sans-serif;
          letter-spacing: 0.1em;
        }
        .sources-list {
          color: #78CBE9;
          font: 600 0.65rem var(--font-space-grotesk), sans-serif;
          letter-spacing: 0.06em;
        }
        .scientific-disclaimer {
          color: rgba(222, 244, 252, 0.5);
          font-size: 0.68rem;
          line-height: 1.4;
          margin: 0;
          font-style: italic;
        }
        @media (max-width: 900px) {
          .workstation-grid {
            grid-template-columns: 1fr;
          }
          .ocean-health-workstation {
            padding: 1rem;
          }
        }
      `}</style>
    </article>
  );
}
