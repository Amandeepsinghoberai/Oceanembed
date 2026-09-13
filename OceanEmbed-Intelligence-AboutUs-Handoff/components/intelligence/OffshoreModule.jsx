'use client';

import React, { useState, useEffect } from 'react';
import OceanLocationMap from './OceanLocationMap';
import { RealSSTDataProvider } from '@/data/RealSSTDataProvider';
import { RealGLORYSDataProvider } from '@/data/RealGLORYSDataProvider';
import { RealProfileDataProvider } from '@/data/RealProfileDataProvider';
import { RealSalinityDataProvider } from '@/data/RealSalinityDataProvider';
import { RealCurrentDataProvider } from '@/data/RealCurrentDataProvider';

export default function OffshoreModule() {
  const [selectedLocation, setSelectedLocation] = useState({
    key: 'site-1',
    lat: 18.5,
    lon: 71.2,
    regionName: 'Arabian Sea Sector'
  });

  const [isLoading, setIsLoading] = useState(true);
  const [siteData, setSiteData] = useState(null);

  const presets = [
    { key: 'site-1', name: 'Arabian Sea Sector', lat: 18.5, lon: 71.2, regionName: 'Arabian Sea Sector' },
    { key: 'site-2', name: 'Krishna-Godavari Deep Water', lat: 15.8, lon: 81.9, regionName: 'Krishna-Godavari Deep Water' },
    { key: 'site-3', name: 'Lakshadweep Ridge Channel', lat: 10.2, lon: 73.5, regionName: 'Lakshadweep Ridge Channel' }
  ];

  useEffect(() => {
    let isCurrent = true;

    async function loadData() {
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

      // 1. Surface Temp: OSTIA Satellite Observation
      const ostiaSST = RealSSTDataProvider.getSST(lat, lon, 0);

      // 2. GLORYS Reference Baseline Data
      const glorysTemp = RealGLORYSDataProvider.getTemperature(lat, lon);
      const glorysSal = RealGLORYSDataProvider.getSalinity(lat, lon);
      const glorysCur = RealGLORYSDataProvider.getCurrent(lat, lon);

      // 3. SMAP Surface Salinity
      const smapSal = RealSalinityDataProvider.getSalinity(lat, lon);

      // 4. HYCOM Surface Currents
      const hycomCur = RealCurrentDataProvider.getCurrent(lat, lon);

      // 5. HYCOM Subsurface Profile
      const profile = RealProfileDataProvider.getProfile(lat, lon);
      const tempAt200 = RealProfileDataProvider.getTemperatureAtDepth(lat, lon, 200);
      const tempAt500 = RealProfileDataProvider.getTemperatureAtDepth(lat, lon, 500);
      const tempAt1000 = RealProfileDataProvider.getTemperatureAtDepth(lat, lon, 1000);

      if (isCurrent) {
        setSiteData({
          ostiaSST,
          glorysTemp,
          glorysSal,
          glorysCur,
          smapSal,
          hycomCur,
          profile,
          tempAt200,
          tempAt500,
          tempAt1000
        });
        setIsLoading(false);
      }
    }

    loadData();

    return () => {
      isCurrent = false;
    };
  }, [selectedLocation]);

  let sstDisplay = 'DATA NOT AVAILABLE';
  let salDisplay = 'DATA NOT AVAILABLE';
  let curSpeedDisplay = 'DATA NOT AVAILABLE';
  let curDirDisplay = 'DATA NOT AVAILABLE';
  let temp200Display = 'DATA NOT AVAILABLE';
  let temp500Display = 'DATA NOT AVAILABLE';
  let temp1000Display = 'DATA NOT AVAILABLE';
  let anomalyDisplay = 'DATA NOT AVAILABLE';
  let anomalyReference = 'VS GLORYS BASELINE';
  let conditionText = 'INSUFFICIENT DATA';
  let conditionClass = 'insufficient';
  let polylinePoints = '';

  const activeSourcesSet = new Set();

  if (!isLoading && siteData) {
    const {
      ostiaSST,
      glorysTemp,
      glorysSal,
      glorysCur,
      smapSal,
      hycomCur,
      profile,
      tempAt200,
      tempAt500,
      tempAt1000
    } = siteData;

    // Surface Temp
    if (ostiaSST !== null) {
      sstDisplay = `${ostiaSST.toFixed(1)} °C`;
      activeSourcesSet.add('OSTIA');
    } else if (glorysTemp !== null) {
      sstDisplay = `${glorysTemp.value.toFixed(1)} °C`;
      activeSourcesSet.add('GLORYS');
    }

    // Salinity
    const salVal = smapSal !== null ? smapSal : (glorysSal?.value ?? null);
    if (salVal !== null) {
      salDisplay = `${salVal.toFixed(1)} PSU`;
      activeSourcesSet.add(smapSal !== null ? 'SMAP' : 'GLORYS');
    }

    // Currents
    const curData = hycomCur || glorysCur;
    if (curData && curData.speed !== undefined) {
      curSpeedDisplay = `${curData.speed.toFixed(2)} m/s`;
      curDirDisplay = `${curData.direction}°`;
      activeSourcesSet.add(hycomCur ? 'HYCOM' : 'GLORYS');
    }

    // Subsurface Temperatures
    if (tempAt200) {
      temp200Display = `${tempAt200.temperature.toFixed(1)} °C`;
      activeSourcesSet.add('HYCOM');
    }
    if (tempAt500) {
      temp500Display = `${tempAt500.temperature.toFixed(1)} °C`;
      activeSourcesSet.add('HYCOM');
    }
    if (tempAt1000) {
      temp1000Display = `${tempAt1000.temperature.toFixed(1)} °C`;
      activeSourcesSet.add('HYCOM');
    }

    // Anomaly calculation & baseline label check
    let anomalyVal = null;
    if (tempAt200 && glorysTemp) {
      anomalyVal = tempAt200.temperature - glorysTemp.value;
      const sign = anomalyVal >= 0 ? '+' : '';
      anomalyDisplay = `${sign}${anomalyVal.toFixed(1)} °C`;
      if (tempAt200.actualDepth <= 10) {
        anomalyReference = 'VS GLORYS BASELINE';
      } else {
        anomalyReference = 'CROSS-DEPTH REFERENCE';
      }
      activeSourcesSet.add('HYCOM');
      activeSourcesSet.add('GLORYS');
    } else if (glorysTemp) {
      anomalyDisplay = '0.0 °C';
      anomalyReference = 'VS GLORYS BASELINE';
      activeSourcesSet.add('GLORYS');
    }

    // Condition Status Logic
    if (curData && curData.speed > 0.8) {
      conditionText = 'ELEVATED';
      conditionClass = 'elevated';
    } else if (anomalyVal !== null && Math.abs(anomalyVal) > 1.2) {
      conditionText = 'UNUSUAL';
      conditionClass = 'unusual';
    } else if (sstDisplay !== 'DATA NOT AVAILABLE') {
      conditionText = 'NORMAL';
      conditionClass = 'normal';
    } else {
      conditionText = 'INSUFFICIENT DATA';
      conditionClass = 'insufficient';
    }

    // SVG Profile Points
    if (profile && profile.temperatures && profile.depths) {
      const points = profile.depths.map((d, i) => {
        const t = profile.temperatures[i];
        const x = 50 + ((t - 4) / 26) * 280;
        const y = 15 + (d / 1000) * 160;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      });
      polylinePoints = points.join(' ');
    }
  }

  const activeSourcesList = Array.from(activeSourcesSet);

  return (
    <article className="intel-card offshore-workstation">
      <div className="workstation-header">
        <h2>OFFSHORE INTELLIGENCE</h2>
        <p className="headline">Ocean conditions for offshore planning and monitoring.</p>
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
          {/* SELECTED SITE */}
          <div className="panel-box location-box">
            <span className="box-label">SELECTED SITE</span>
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

          {/* SURFACE CONDITIONS */}
          <div className="panel-box conditions-box">
            <span className="box-label">SURFACE CONDITIONS</span>
            <div className="metrics-grid">
              <div className="metric-card">
                <span className="metric-name">SST</span>
                <strong className="metric-val">{isLoading ? '...' : sstDisplay}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-name">SALINITY</span>
                <strong className="metric-val">{isLoading ? '...' : salDisplay}</strong>
              </div>
            </div>
          </div>

          {/* CURRENT CONDITIONS */}
          <div className="panel-box conditions-box">
            <span className="box-label">CURRENT CONDITIONS</span>
            <div className="metrics-grid">
              <div className="metric-card">
                <span className="metric-name">SPEED</span>
                <strong className="metric-val">{isLoading ? '...' : curSpeedDisplay}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-name">DIRECTION</span>
                <strong className="metric-val">{isLoading ? '...' : curDirDisplay}</strong>
              </div>
            </div>
          </div>

          {/* SUBSURFACE CONDITIONS */}
          <div className="panel-box conditions-box">
            <div className="box-header-row">
              <span className="box-label">SUBSURFACE CONDITIONS</span>
              <span className="source-tag">HYCOM ANALYSIS</span>
            </div>
            <div className="metrics-grid-3">
              <div className="metric-card">
                <span className="metric-name">200 m</span>
                <strong className="metric-val">{isLoading ? '...' : temp200Display}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-name">500 m</span>
                <strong className="metric-val">{isLoading ? '...' : temp500Display}</strong>
              </div>
              <div className="metric-card">
                <span className="metric-name">1000 m</span>
                <strong className="metric-val">{isLoading ? '...' : temp1000Display}</strong>
              </div>
            </div>
          </div>

          {/* OCEAN CONDITION STATUS */}
          <div className="panel-box status-box">
            <div className="status-row">
              <span className="box-label">OCEAN CONDITION STATUS</span>
              <span className={`status-badge ${conditionClass}`}>
                {isLoading ? 'LOADING...' : conditionText}
              </span>
            </div>
          </div>

          {/* TEMPERATURE ANOMALY */}
          <div className="panel-box anomaly-box">
            <div className="anomaly-header">
              <div>
                <span className="box-label">TEMPERATURE ANOMALY</span>
                <span className="anomaly-ref">{anomalyReference}</span>
              </div>
              <strong className="anomaly-val">{isLoading ? '...' : anomalyDisplay}</strong>
            </div>
          </div>

          {/* VERTICAL TEMPERATURE PROFILE */}
          <div className="panel-box profile-box">
            <span className="box-label">VERTICAL TEMPERATURE PROFILE (0–1000 m)</span>
            <div className="profile-chart">
              <svg viewBox="0 0 350 190" className="profile-svg">
                {/* Background Grid */}
                <rect width="350" height="190" fill="rgba(1, 9, 21, 0.7)" rx="3" stroke="rgba(120, 203, 233, 0.12)" />
                <line x1="50" y1="15" x2="50" y2="170" stroke="rgba(120, 203, 233, 0.2)" />
                <line x1="50" y1="170" x2="330" y2="170" stroke="rgba(120, 203, 233, 0.2)" />

                {/* Y-Axis Depth Markers */}
                <text x="42" y="20" textAnchor="end" fill="rgba(222,244,252,0.5)" fontSize="8">0m</text>
                <text x="42" y="55" textAnchor="end" fill="rgba(222,244,252,0.5)" fontSize="8">200m</text>
                <text x="42" y="100" textAnchor="end" fill="rgba(222,244,252,0.5)" fontSize="8">500m</text>
                <text x="42" y="145" textAnchor="end" fill="rgba(222,244,252,0.5)" fontSize="8">800m</text>
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

          {/* DATA SOURCES */}
          <div className="sources-row">
            <span className="sources-label">DATA SOURCES</span>
            <span className="sources-list">
              {activeSourcesList.length > 0 ? activeSourcesList.join(' · ') : 'OSTIA · HYCOM · GLORYS'}
            </span>
          </div>

          {/* SCIENTIFIC DISCLAIMER */}
          <p className="scientific-disclaimer">
            Ocean-condition indicators support offshore planning and monitoring; they are not engineering safety certification.
          </p>
        </div>
      </div>

      <style>{`
        .offshore-workstation {
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
        .box-header-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.4rem;
        }
        .box-header-row .box-label {
          margin-bottom: 0;
        }
        .source-tag {
          color: rgba(120, 203, 233, 0.6);
          font: 600 0.54rem var(--font-public-sans), sans-serif;
          letter-spacing: 0.08em;
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
        }
        .metrics-grid-3 {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
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
          .offshore-workstation {
            padding: 1rem;
          }
        }
      `}</style>
    </article>
  );
}
