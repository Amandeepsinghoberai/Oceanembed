'use client';

import React, { useState } from 'react';
import RealOceanMap from '@/components/solution/RealOceanMap';

export default function InteractiveIntelligenceExplorer() {
  const [selectedLocation, setSelectedLocation] = useState({
    lat: 15.2,
    lon: 72.8,
    regionName: 'Arabian Sea'
  });
  const [depth, setDepth] = useState(500);

  // Compute conceptual metrics based on location & depth
  const latDisplay = selectedLocation ? selectedLocation.lat.toFixed(1) : '15.2';
  const lonDisplay = selectedLocation ? selectedLocation.lon.toFixed(1) : '72.8';
  const regionName = selectedLocation ? selectedLocation.regionName : 'Arabian Sea';

  // Derived ocean parameters
  const surfaceTemp = (27.2 + Math.sin(selectedLocation.lat * 0.1) * 1.5).toFixed(1);
  const depthTemp = Math.max(4.2, (parseFloat(surfaceTemp) - (depth / 1000) * 18.5)).toFixed(1);
  const salinity = (35.1 + (selectedLocation.lon > 80 ? -1.2 : 0.4)).toFixed(1);
  const currentSpeed = (0.4 + Math.abs(Math.sin(selectedLocation.lat * 0.3)) * 0.5).toFixed(2);
  const anomalyLevel = depth > 400 && selectedLocation.lat > 12 ? 'MODERATE' : 'LOW';
  const suitabilityScore = Math.min(95, Math.max(40, Math.round(85 - Math.abs(selectedLocation.lat - 15) * 2)));

  return (
    <section className="interactive-explorer-section">
      <div className="explorer-container">
        <div className="explorer-header">
          <span className="section-tag">7. INTERACTIVE EXPERIENCE</span>
          <h2>EXPLORE OCEAN INTELLIGENCE BY LOCATION</h2>
          <p className="explorer-desc">
            Select any point in the Indian Ocean to inspect real-time reconstructed surface and subsurface intelligence.
          </p>
        </div>

        <div className="explorer-grid">
          {/* Left: Real Ocean D3 Map */}
          <div className="map-wrapper">
            <RealOceanMap 
              depth={depth} 
              isSurface={depth === 0} 
              selectedLocation={selectedLocation} 
              setSelectedLocation={setSelectedLocation} 
              selectedDateIndex={0} 
            />
          </div>

          {/* Right: Live Intelligence Inspection Panel */}
          <div className="inspection-panel">
            <div className="panel-head">
              <span className="panel-tag">SELECTED COORDINATES</span>
              <h3>{latDisplay}°N, {lonDisplay}°E</h3>
              <span className="region-pill">{regionName}</span>
            </div>

            {/* Depth Slider */}
            <div className="depth-slider-control">
              <div className="slider-label-row">
                <span>TARGET DEPTH LEVEL</span>
                <strong>{depth} m</strong>
              </div>
              <input 
                type="range" 
                min="0" 
                max="1000" 
                step="50" 
                value={depth} 
                onChange={(e) => setDepth(Number(e.target.value))} 
                className="depth-range-input"
              />
              <div className="slider-ticks">
                <span>0m (Surface)</span>
                <span>500m</span>
                <span>1000m (Deep)</span>
              </div>
            </div>

            {/* Reconstructed Metrics */}
            <div className="metrics-grid">
              <div className="m-box">
                <span className="m-lbl">TEMPERATURE T(z)</span>
                <strong className="m-val highlight-teal">{depthTemp} °C</strong>
                <span className="m-sub">Surface: {surfaceTemp}°C</span>
              </div>

              <div className="m-box">
                <span className="m-lbl">SALINITY S(z)</span>
                <strong className="m-val">{salinity} PSU</strong>
                <span className="m-sub">Halocline layer</span>
              </div>

              <div className="m-box">
                <span className="m-lbl">CURRENT VELOCITY</span>
                <strong className="m-val">{currentSpeed} m/s</strong>
                <span className="m-sub">Geostrophic vector</span>
              </div>

              <div className="m-box">
                <span className="m-lbl">ANOMALY STATUS</span>
                <strong className={`m-val ${anomalyLevel === 'MODERATE' ? 'highlight-warn' : ''}`}>{anomalyLevel}</strong>
                <span className="m-sub">Subsurface divergence</span>
              </div>
            </div>

            {/* 4 Domain Quick Assessment Summary */}
            <div className="domain-summary-list">
              <span className="sum-title">DOMAIN INTELLIGENCE FEEDBACK:</span>

              <div className="sum-row">
                <span className="sum-domain">FISHERIES</span>
                <span className="sum-detail">Suitability: <strong>{suitabilityScore} / 100</strong> ({suitabilityScore >= 75 ? 'Favorable' : 'Moderate'})</span>
              </div>

              <div className="sum-row">
                <span className="sum-domain">OCEAN HEALTH</span>
                <span className="sum-detail">Subsurface Status: <strong className={anomalyLevel === 'MODERATE' ? 'warn' : 'good'}>{anomalyLevel === 'MODERATE' ? 'Subsurface Anomaly Detected' : 'Baseline Nominal'}</strong></span>
              </div>

              <div className="sum-row">
                <span className="sum-domain">OFFSHORE</span>
                <span className="sum-detail">Environmental Concern: <strong>Low Concern</strong> (Thermocline stable)</span>
              </div>

              <div className="sum-row">
                <span className="sum-domain">MARITIME</span>
                <span className="sum-detail">Surface Current Impact: <strong>{currentSpeed > 0.6 ? 'Moderate Resistance' : 'Favorable Flow'}</strong></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .interactive-explorer-section {
          padding: 5rem 0;
          margin-bottom: 4rem;
        }
        .explorer-container {
          width: min(1240px, calc(100% - 3rem));
          margin: 0 auto;
        }
        .explorer-header {
          text-align: center;
          max-width: 750px;
          margin: 0 auto 3rem auto;
        }
        .section-tag {
          color: #7ce0d0;
          font: 600 0.7rem var(--font-public-sans), sans-serif;
          letter-spacing: 0.14em;
          display: block;
          margin-bottom: 0.5rem;
        }
        .explorer-header h2 {
          color: #fff;
          font: 600 clamp(1.8rem, 3vw, 2.6rem) var(--font-space-grotesk), sans-serif;
          margin: 0 0 0.8rem 0;
          letter-spacing: -0.01em;
        }
        .explorer-desc {
          color: rgba(222, 244, 252, 0.7);
          font-size: 0.95rem;
          line-height: 1.6;
          margin: 0;
        }
        .explorer-grid {
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          gap: 2rem;
          align-items: stretch;
        }
        .map-wrapper {
          min-height: 480px;
          border-radius: 4px;
          overflow: hidden;
        }
        .inspection-panel {
          background: rgba(3, 17, 36, 0.85);
          border: 1px solid rgba(120, 203, 233, 0.2);
          border-radius: 4px;
          padding: 1.8rem;
          display: flex;
          flex-direction: column;
          gap: 1.4rem;
          backdrop-filter: blur(6px);
        }
        .panel-head {
          border-bottom: 1px solid rgba(120, 203, 233, 0.15);
          padding-bottom: 1rem;
        }
        .panel-tag {
          font: 600 0.6rem var(--font-public-sans), sans-serif;
          color: rgba(120, 203, 233, 0.65);
          letter-spacing: 0.12em;
          display: block;
        }
        .panel-head h3 {
          color: #fff;
          font: 600 1.6rem var(--font-space-grotesk), sans-serif;
          margin: 0.3rem 0 0.5rem 0;
        }
        .region-pill {
          display: inline-block;
          background: rgba(124, 224, 208, 0.15);
          color: #7ce0d0;
          border: 1px solid rgba(124, 224, 208, 0.4);
          font: 600 0.65rem var(--font-space-grotesk), sans-serif;
          padding: 0.2rem 0.6rem;
          border-radius: 2px;
          letter-spacing: 0.08em;
        }
        .depth-slider-control {
          background: rgba(1, 9, 21, 0.6);
          padding: 1rem;
          border-radius: 4px;
          border: 1px solid rgba(120, 203, 233, 0.15);
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }
        .slider-label-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.8rem;
        }
        .slider-label-row span {
          color: rgba(120, 203, 233, 0.7);
          font: 600 0.6rem var(--font-public-sans), sans-serif;
          letter-spacing: 0.08em;
        }
        .slider-label-row strong {
          color: #7ce0d0;
          font-family: var(--font-space-grotesk), sans-serif;
        }
        .depth-range-input {
          width: 100%;
          accent-color: #7ce0d0;
          cursor: pointer;
        }
        .slider-ticks {
          display: flex;
          justify-content: space-between;
          color: rgba(222, 244, 252, 0.4);
          font-size: 0.7rem;
        }
        .metrics-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.8rem;
        }
        .m-box {
          background: rgba(8, 60, 97, 0.25);
          border: 1px solid rgba(120, 203, 233, 0.12);
          padding: 0.9rem;
          border-radius: 2px;
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
        }
        .m-lbl {
          font: 600 0.58rem var(--font-public-sans), sans-serif;
          color: rgba(120, 203, 233, 0.6);
          letter-spacing: 0.08em;
        }
        .m-val {
          color: #fff;
          font: 600 1.15rem var(--font-space-grotesk), sans-serif;
        }
        .m-val.highlight-teal {
          color: #7ce0d0;
        }
        .m-val.highlight-warn {
          color: #f3c98b;
        }
        .m-sub {
          font-size: 0.72rem;
          color: rgba(222, 244, 252, 0.5);
        }
        .domain-summary-list {
          background: rgba(1, 9, 21, 0.6);
          padding: 1rem;
          border-radius: 4px;
          border: 1px solid rgba(120, 203, 233, 0.15);
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }
        .sum-title {
          font: 600 0.6rem var(--font-public-sans), sans-serif;
          color: #78CBE9;
          letter-spacing: 0.1em;
          display: block;
          margin-bottom: 0.2rem;
        }
        .sum-row {
          display: flex;
          justify-content: space-between;
          font-size: 0.8rem;
          border-bottom: 1px solid rgba(120, 203, 233, 0.08);
          padding-bottom: 0.4rem;
        }
        .sum-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        .sum-domain {
          color: #7ce0d0;
          font: 600 0.7rem var(--font-space-grotesk), sans-serif;
          letter-spacing: 0.05em;
        }
        .sum-detail {
          color: rgba(222, 244, 252, 0.7);
        }
        .sum-detail strong {
          color: #fff;
        }
        .sum-detail strong.warn {
          color: #f3c98b;
        }
        .sum-detail strong.good {
          color: #7ce0d0;
        }
        @media (max-width: 950px) {
          .explorer-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
