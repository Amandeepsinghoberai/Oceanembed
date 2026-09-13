'use client';

import React, { useState, useEffect } from 'react';
import OceanLocationMap from './OceanLocationMap';
import { RealSSTDataProvider } from '@/data/RealSSTDataProvider';
import { RealGLORYSDataProvider } from '@/data/RealGLORYSDataProvider';
import { RealProfileDataProvider } from '@/data/RealProfileDataProvider';
import { RealSalinityDataProvider } from '@/data/RealSalinityDataProvider';
import { RealCurrentDataProvider } from '@/data/RealCurrentDataProvider';

export default function FisheriesModule() {
  const [selectedLocation, setSelectedLocation] = useState({
    key: 'zone-a',
    lat: 15.0,
    lon: 64.96,
    regionName: 'Arabian Sea Shelf'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [envData, setEnvData] = useState(null);

  const presets = [
    { key: 'zone-a', name: 'Arabian Sea Shelf', lat: 15.0, lon: 64.96, regionName: 'Arabian Sea Shelf' },
    { key: 'zone-b', name: 'Bay of Bengal', lat: 14.2, lon: 84.5, regionName: 'Bay of Bengal' },
    { key: 'zone-c', name: 'Equatorial Pass', lat: -0.5, lon: 78.0, regionName: 'Equatorial Pass' }
  ];

  useEffect(() => {
    let isCurrent = true;

    async function loadRealData() {
      setIsLoading(true);
      await Promise.all([
        RealSSTDataProvider.load(),
        RealGLORYSDataProvider.load(),
        RealProfileDataProvider.load(),
        RealSalinityDataProvider.load(),
        RealCurrentDataProvider.load()
      ]);

      if (!isCurrent) return;

      const lat = selectedLocation.lat;
      const lon = selectedLocation.lon;

      // 1. OSTIA Observed SST
      const ostiaSST = RealSSTDataProvider.getSST(lat, lon, 0);

      // 2. GLORYS Reference Baseline Data
      const glorysTemp = RealGLORYSDataProvider.getTemperature(lat, lon);
      const glorysSal = RealGLORYSDataProvider.getSalinity(lat, lon);
      const glorysCur = RealGLORYSDataProvider.getCurrent(lat, lon);

      // 3. SMAP Salinity & HYCOM Currents
      const smapSal = RealSalinityDataProvider.getSalinity(lat, lon);
      const hycomCur = RealCurrentDataProvider.getCurrent(lat, lon);

      // 4. HYCOM Analysis Subsurface Profile
      const profile = RealProfileDataProvider.getProfile(lat, lon);
      const tempAt200 = RealProfileDataProvider.getTemperatureAtDepth(lat, lon, 200);

      if (isCurrent) {
        setEnvData({
          ostiaSST,
          glorysTemp,
          glorysSal,
          glorysCur,
          smapSal,
          hycomCur,
          profile,
          tempAt200
        });
        setIsLoading(false);
      }
    }

    loadRealData();

    return () => {
      isCurrent = false;
    };
  }, [selectedLocation]);

  // Environmental Suitability Calculations
  let tempScore = 0;
  let salScore = 0;
  let curScore = 0;
  let profScore = 0;
  let totalScore = 0;

  let tempDisplay = 'DATA UNAVAILABLE';
  let tempSource = null;
  let salDisplay = 'DATA UNAVAILABLE';
  let salSource = null;
  let curSpeedDisplay = 'DATA UNAVAILABLE';
  let curDirDisplay = 'DATA UNAVAILABLE';
  let curSource = null;
  let profDisplay = 'DATA UNAVAILABLE';
  let profSource = null;

  const activeSourcesSet = new Set();

  if (!isLoading && envData) {
    const { ostiaSST, glorysTemp, glorysSal, glorysCur, smapSal, hycomCur, profile, tempAt200 } = envData;

    // Temperature
    const currentTemp = ostiaSST !== null ? ostiaSST : (glorysTemp?.value ?? null);
    if (currentTemp !== null) {
      tempDisplay = `${currentTemp.toFixed(1)} °C`;
      tempSource = ostiaSST !== null ? 'OSTIA' : 'GLORYS';
      activeSourcesSet.add(tempSource);

      if (currentTemp >= 24.0 && currentTemp <= 28.5) tempScore = 30;
      else if (currentTemp > 28.5 && currentTemp <= 30.0) tempScore = 22;
      else if (currentTemp < 24.0 && currentTemp >= 20.0) tempScore = 20;
      else tempScore = 12;
    }

    // Salinity
    const currentSal = smapSal !== null ? smapSal : (glorysSal?.value ?? null);
    if (currentSal !== null) {
      salDisplay = `${currentSal.toFixed(1)} PSU`;
      salSource = smapSal !== null ? 'SMAP' : 'GLORYS';
      activeSourcesSet.add(salSource);

      if (currentSal >= 34.2 && currentSal <= 35.8) salScore = 25;
      else if (currentSal < 34.2) salScore = 16;
      else salScore = 18;
    }

    // Currents
    const curObj = hycomCur || glorysCur;
    if (curObj !== null && curObj.speed !== undefined) {
      curSpeedDisplay = `${curObj.speed.toFixed(2)} m/s`;
      curDirDisplay = `${curObj.direction}°`;
      curSource = hycomCur ? 'HYCOM' : 'GLORYS';
      activeSourcesSet.add(curSource);

      const spd = curObj.speed;
      if (spd >= 0.2 && spd <= 0.6) curScore = 25;
      else if (spd > 0.6 && spd <= 1.0) curScore = 18;
      else if (spd > 1.0) curScore = 12;
      else curScore = 15;
    }

    // Profile / Subsurface
    if (profile && tempAt200) {
      profDisplay = `0–200 m (T₂₀₀m: ${tempAt200.temperature.toFixed(1)} °C)`;
      profSource = 'HYCOM';
      activeSourcesSet.add(profSource);

      const surfTemp = profile.temperatures[0];
      const deltaT = surfTemp - tempAt200.temperature;
      if (deltaT >= 8.0) profScore = 20;
      else if (deltaT >= 4.0) profScore = 16;
      else profScore = 10;
    } else {
      profDisplay = 'DATA UNAVAILABLE';
      profScore = 0;
    }

    totalScore = Math.min(100, Math.max(0, tempScore + salScore + curScore + profScore));
  }

  let statusText = 'INSUFFICIENT DATA';
  let statusClass = 'insufficient';

  if (!isLoading && envData) {
    if (totalScore >= 80) {
      statusText = 'FAVORABLE';
      statusClass = 'favorable';
    } else if (totalScore >= 50) {
      statusText = 'MODERATE';
      statusClass = 'moderate';
    } else if (totalScore > 0) {
      statusText = 'LESS SUITABLE';
      statusClass = 'less';
    }
  }

  const activeSourcesList = Array.from(activeSourcesSet);

  return (
    <article className="intel-card fisheries-workstation">
      <div className="workstation-header">
        <h2>FISHERIES</h2>
        <p className="headline">Environmental suitability based on ocean conditions.</p>
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

        {/* RIGHT COLUMN: INFORMATION & CONTROL PANEL */}
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

          {/* OCEAN CONDITIONS */}
          <div className="panel-box conditions-box">
            <span className="box-label">CURRENT CONDITIONS</span>
            <div className="metrics-grid">
              <div className="metric-card">
                <span className="metric-name">SEA SURFACE TEMP</span>
                <strong className="metric-val">{isLoading ? '...' : tempDisplay}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-name">SALINITY</span>
                <strong className="metric-val">{isLoading ? '...' : salDisplay}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-name">CURRENT SPEED</span>
                <strong className="metric-val">{isLoading ? '...' : curSpeedDisplay}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-name">CURRENT DIRECTION</span>
                <strong className="metric-val">{isLoading ? '...' : curDirDisplay}</strong>
              </div>
            </div>
            <div className="subsurface-row">
              <span className="metric-name">SUBSURFACE / THERMOCLINE</span>
              <span className="subsurface-val">{isLoading ? '...' : profDisplay}</span>
            </div>
          </div>

          {/* ENVIRONMENTAL SUITABILITY */}
          <div className="panel-box suitability-box">
            <div className="suitability-top">
              <div>
                <span className="box-label">ENVIRONMENTAL SUITABILITY</span>
                <span className={`status-badge ${statusClass}`}>
                  {isLoading ? 'LOADING...' : statusText}
                </span>
              </div>
              <div className="score-display">
                <strong className="score-num">{isLoading ? '...' : totalScore}</strong>
                <span className="score-denom">/ 100</span>
              </div>
            </div>

            {/* SCORE BREAKDOWN */}
            <div className="breakdown-list">
              <div className="breakdown-row">
                <div className="breakdown-header">
                  <span>TEMPERATURE</span>
                  <span>{isLoading ? '...' : `${tempScore} / 30`}</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(tempScore / 30) * 100}%` }}></div>
                </div>
              </div>

              <div className="breakdown-row">
                <div className="breakdown-header">
                  <span>SALINITY</span>
                  <span>{isLoading ? '...' : `${salScore} / 25`}</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(salScore / 25) * 100}%` }}></div>
                </div>
              </div>

              <div className="breakdown-row">
                <div className="breakdown-header">
                  <span>CURRENT</span>
                  <span>{isLoading ? '...' : `${curScore} / 25`}</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(curScore / 25) * 100}%` }}></div>
                </div>
              </div>

              <div className="breakdown-row">
                <div className="breakdown-header">
                  <span>PROFILE</span>
                  <span>{isLoading ? '...' : `${profScore} / 20`}</span>
                </div>
                <div className="bar-track">
                  <div className="bar-fill" style={{ width: `${(profScore / 20) * 100}%` }}></div>
                </div>
              </div>
            </div>
          </div>

          {/* DATA SOURCES */}
          <div className="sources-row">
            <span className="sources-label">DATA SOURCES</span>
            <span className="sources-list">
              {activeSourcesList.length > 0 ? activeSourcesList.join(' · ') : 'OSTIA · GLORYS · HYCOM'}
            </span>
          </div>

          {/* SCIENTIFIC DISCLAIMER */}
          <p className="scientific-disclaimer">
            Environmental suitability based on physical ocean conditions; not fish detection or abundance prediction. Prototype thresholds require fisheries-specific validation.
          </p>
        </div>
      </div>

      <style>{`
        .fisheries-workstation {
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
        .metrics-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0.5rem;
          margin-bottom: 0.6rem;
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
        .subsurface-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(8, 60, 97, 0.2);
          border: 1px solid rgba(120, 203, 233, 0.1);
          padding: 0.45rem 0.6rem;
          border-radius: 2px;
        }
        .subsurface-val {
          color: #7ce0d0;
          font: 600 0.8rem var(--font-space-grotesk), sans-serif;
        }
        .suitability-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          padding-bottom: 0.75rem;
          margin-bottom: 0.75rem;
          border-bottom: 1px solid rgba(120, 203, 233, 0.12);
        }
        .status-badge {
          display: inline-block;
          font: 700 0.62rem var(--font-space-grotesk), sans-serif;
          letter-spacing: 0.1em;
          padding: 0.2rem 0.5rem;
          border-radius: 2px;
          margin-top: 0.2rem;
        }
        .status-badge.favorable {
          background: rgba(124, 224, 208, 0.15);
          color: #7ce0d0;
          border: 1px solid rgba(124, 224, 208, 0.4);
        }
        .status-badge.moderate {
          background: rgba(243, 201, 139, 0.15);
          color: #f3c98b;
          border: 1px solid rgba(243, 201, 139, 0.4);
        }
        .status-badge.less {
          background: rgba(217, 83, 79, 0.15);
          color: #e06c69;
          border: 1px solid rgba(217, 83, 79, 0.4);
        }
        .status-badge.insufficient {
          background: rgba(255, 255, 255, 0.1);
          color: rgba(255, 255, 255, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.2);
        }
        .score-display {
          display: flex;
          align-items: baseline;
          gap: 0.2rem;
        }
        .score-num {
          color: #fff;
          font: 700 1.8rem var(--font-space-grotesk), sans-serif;
          line-height: 1;
        }
        .score-denom {
          color: rgba(222, 244, 252, 0.45);
          font-size: 0.78rem;
        }
        .breakdown-list {
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }
        .breakdown-row {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }
        .breakdown-header {
          display: flex;
          justify-content: space-between;
          font: 600 0.6rem var(--font-public-sans), sans-serif;
          color: rgba(222, 244, 252, 0.7);
          letter-spacing: 0.05em;
        }
        .bar-track {
          width: 100%;
          height: 5px;
          background: rgba(120, 203, 233, 0.12);
          border-radius: 2px;
          overflow: hidden;
        }
        .bar-fill {
          height: 100%;
          background: #7ce0d0;
          border-radius: 2px;
          transition: width 0.35s ease;
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
          .fisheries-workstation {
            padding: 1rem;
          }
        }
      `}</style>
    </article>
  );
}
