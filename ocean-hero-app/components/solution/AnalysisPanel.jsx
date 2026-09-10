'use client';

import React, { useState, useEffect } from 'react';
import { MockOceanDataProvider } from '@/data/MockOceanDataProvider';

import { RealSSTDataProvider } from '@/data/RealSSTDataProvider';
import { RealSalinityDataProvider } from '@/data/RealSalinityDataProvider';
import { RealCurrentDataProvider } from '@/data/RealCurrentDataProvider';
import { RealGLORYSDataProvider } from '@/data/RealGLORYSDataProvider';
import { RealOceanDataProvider } from '@/data/RealOceanDataProvider';
import { RealProfileDataProvider } from '@/data/RealProfileDataProvider';
import { RealWindDataProvider } from '@/data/RealWindDataProvider';

export default function AnalysisPanel({ depth, setDepth, isSurface, setIsSurface, selectedLocation, selectedDateIndex, setSelectedDateIndex, availableDates }) {
  const [realSST, setRealSST] = useState(null);
  const [realSalinity, setRealSalinity] = useState(null);
  const [realCurrent, setRealCurrent] = useState(null);
  const [glorysTemperature, setGlorysTemperature] = useState(null);
  const [glorysSalinity, setGlorysSalinity] = useState(null);
  const [glorysCurrent, setGlorysCurrent] = useState(null);
  const [glorysSSH, setGlorysSSH] = useState(null);
  const [realWind, setRealWind] = useState(null);
  const [realProfile, setRealProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchRealData() {
      setIsLoading(true);
      await Promise.all([
        RealSSTDataProvider.load(),
        RealSalinityDataProvider.load(),
        RealCurrentDataProvider.load(),
        RealGLORYSDataProvider.load(),
        RealProfileDataProvider.load(),
        RealWindDataProvider.load()
      ]);
      
      // Prefetch the chunk into memory dynamically since the unified UI drives everything off Grid data.
      await RealSSTDataProvider.getSSTGrid(selectedDateIndex);
      
      const sst = RealSSTDataProvider.getSST(
        selectedLocation.lat,
        selectedLocation.lon,
        selectedDateIndex
      );
      const sal = RealSalinityDataProvider.getSalinity(
        selectedLocation.lat,
        selectedLocation.lon,
        selectedDateIndex
      );
      const cur = RealCurrentDataProvider.getCurrent(
        selectedLocation.lat,
        selectedLocation.lon,
        selectedDateIndex
      );
      const fallbackTemperature = RealGLORYSDataProvider.getTemperature(
        selectedLocation.lat,
        selectedLocation.lon
      );
      const fallbackSalinity = RealGLORYSDataProvider.getSalinity(
        selectedLocation.lat,
        selectedLocation.lon
      );
      const fallbackCurrent = RealGLORYSDataProvider.getCurrent(
        selectedLocation.lat,
        selectedLocation.lon
      );
      const fallbackSSH = RealGLORYSDataProvider.getSSH(
        selectedLocation.lat,
        selectedLocation.lon
      );
      const wind = RealWindDataProvider.getWind(
        selectedLocation.lat,
        selectedLocation.lon
      );
      const prof = RealProfileDataProvider.getProfile(
        selectedLocation.lat,
        selectedLocation.lon
      );
      setRealSST(sst);
      setRealSalinity(sal);
      setRealCurrent(cur);
      setGlorysTemperature(fallbackTemperature);
      setGlorysSalinity(fallbackSalinity);
      setGlorysCurrent(fallbackCurrent);
      setGlorysSSH(fallbackSSH);
      setRealWind(wind);
      setRealProfile(prof);
      setIsLoading(false);
    }
    fetchRealData();
  }, [selectedLocation, selectedDateIndex]);

  const currentData = realProfile ? RealProfileDataProvider.getTemperatureAtDepth(selectedLocation.lat, selectedLocation.lon, depth) : null;
  const currentTempDisplay = currentData ? `${currentData.temperature.toFixed(1)}°C` : "DATA UNAVAILABLE";
  const currentSourceDisplay = currentData ? `${currentData.source} (${currentData.timestamp.split('T')[0]} 12:00 UTC)` : "DATA UNAVAILABLE";

  const surfaceTemperature = realSST !== null ? realSST : glorysTemperature?.value ?? null;
  const surfaceTemperatureSource = realSST !== null ? 'OSTIA' : glorysTemperature?.source;
  const salinity = realSalinity !== null ? `${realSalinity} PSU` : glorysSalinity ? `${glorysSalinity.value.toFixed(1)} PSU` : "DATA UNAVAILABLE";
  const current = realCurrent || glorysCurrent;
  const ssh = glorysSSH;

  // Normalize depth value to visually display 0 - 1000 properly in SVG rendering mock
  const graphDepthRatio = depth / 1000;
  
  let polylinePoints = "";
  if (realProfile && realProfile.temperatures && realProfile.depths) {
      const points = realProfile.depths.map((d, i) => {
         const t = realProfile.temperatures[i];
         const x = (t - 5) * 4;
         const y = d * 0.04;
         return `${x},${y}`;
      });
      polylinePoints = points.join(" ");
  }
  return (
    <div className="analysis-panel">
      
      {/* Mode Selector */}
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
          <div className="loc-region">{selectedLocation.regionName}</div>
          <div className="loc-coords">
            {selectedLocation.lat >= 0 ? `${selectedLocation.lat}° N` : `${Math.abs(selectedLocation.lat)}° S`} • {selectedLocation.lon >= 0 ? `${selectedLocation.lon}° E` : `${Math.abs(selectedLocation.lon)}° W`}
          </div>
        </div>
      </div>

      <hr className="divider" />

      {/* Temperature Readout */}
      <div className="panel-section metrics-grid" style={{ marginBottom: '-1rem' }}>
         <div className="metric">
            <span className="m-label">TEMPERATURE</span>
            <div className="temp-main">
              {isLoading ? "..." : (
                isSurface ? (surfaceTemperature !== null ? `${surfaceTemperature.toFixed(1)}°C` : "UNAVAILABLE") : currentTempDisplay
              )}
            </div>
            {isSurface && surfaceTemperatureSource && (
              <span className="metric-source">SOURCE: {surfaceTemperatureSource}</span>
            )}
         </div>
         <div className="metric">
            <span className="m-label">OBSERVATION DATE</span>
            {availableDates && availableDates.length > 0 && (
              <div className="dates-list" style={{ marginTop: '0.25rem' }}>
                {availableDates.map((dateStr, idx) => {
                   const shortDate = dateStr.split('T')[0];
                   const isSelected = selectedDateIndex === idx;
                   return (
                     <button 
                       key={dateStr} 
                       className={`date-btn ${isSelected ? 'active' : ''}`}
                       onClick={() => setSelectedDateIndex && setSelectedDateIndex(idx)}
                     >
                       {shortDate}
                     </button>
                   );
                })}
              </div>
            )}
         </div>
      </div>

      <hr className="divider" />

      {/* Ocean Variables */}
      <div className="panel-section metrics-grid">
         <div className="metric">
            <span className="m-label">SALINITY</span>
            <span className="m-val">{salinity}</span>
         </div>
        <div className="metric">
          <span className="m-label">CURRENT ({(current?.timestamp || RealCurrentDataProvider.getAvailableDates()[0])?.replace('T', ' ').replace('Z', ' UTC') || 'LATEST'})</span>
          {current !== null ? (
               <div style={{display: 'flex', flexDirection: 'column', gap: '0.1rem'}}>
              <span className="m-val">{current.speed.toFixed(3)} m/s ({current.direction}°)</span>
              <span style={{fontSize: '0.65rem', opacity: 0.6, letterSpacing: '0.05em'}}>U: {current.u.toFixed(3)} | V: {current.v.toFixed(3)}</span>
               </div>
            ) : <span className="m-val">DATA UNAVAILABLE</span>}
         </div>
      </div>

      <div className="panel-section metrics-grid">
        <div className="metric">
          <span className="m-label">SEA SURFACE HEIGHT</span>
          {ssh ? (
            <>
             <span className="m-val">{ssh.value.toFixed(3)} m</span>
            </>
          ) : <span className="m-val">DATA UNAVAILABLE</span>}
        </div>
      </div>

      <hr className="divider" />

      {/* Wind Variables — NOAA GFS 0.25° */}
      <div className="panel-section metrics-grid">
         <div className="metric">
            <span className="m-label">WIND (2026-09-07 00:00 UTC)</span>
            {realWind !== null ? (
               <div style={{display: 'flex', flexDirection: 'column', gap: '0.1rem'}}>
                  <span className="m-val">{realWind.speed.toFixed(3)} m/s ({realWind.direction}° FROM)</span>
                  <span style={{fontSize: '0.65rem', opacity: 0.6, letterSpacing: '0.05em'}}>U: {realWind.u.toFixed(3)} | V: {realWind.v.toFixed(3)} m/s</span>
               </div>
            ) : <span className="m-val">DATA UNAVAILABLE</span>}
         </div>
         <div className="metric">
            <span className="m-label">WIND SOURCE</span>
            <span style={{fontSize: '0.65rem', opacity: 0.7, letterSpacing: '0.04em', lineHeight: 1.4}}>
              {realWind !== null ? 'NOAA GFS 0.25° Global Analysis' : '—'}
            </span>
         </div>
      </div>

      {!isSurface && (
        <>
          <hr className="divider" />

          {/* Temperature Profile SVG */}
          <div className="panel-section">
            <div className="section-label">PROFILE (0–1000m)</div>
            <div className="profile-chart">
               <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="chart-svg">
                  {/* Grid lines */}
                  <line x1="0" y1="10" x2="100" y2="10" stroke="#15799e" strokeWidth="0.2" opacity="0.3" />
                  <line x1="0" y1="20" x2="100" y2="20" stroke="#15799e" strokeWidth="0.2" opacity="0.3" />
                  <line x1="0" y1="30" x2="100" y2="30" stroke="#15799e" strokeWidth="0.2" opacity="0.3" />
                  
                  {/* Thermocline mock graph */}
                  {polylinePoints ? (
                     <polyline points={polylinePoints} fill="none" stroke="#7ce0d0" strokeWidth="1.5" />
                  ) : (
                     <path d="M 5 0 Q 35 15, 65 30 T 95 40" fill="none" stroke="rgba(124, 224, 208, 0.3)" strokeWidth="1.5" strokeDasharray="2 2" />
                  )}
                  
                  {/* Dynamic Tracker based on depth slider */}
                  <line x1={5 + graphDepthRatio*90} y1="0" x2={5 + graphDepthRatio*90} y2="40" stroke="#fff" strokeWidth="0.5" strokeDasharray="1 1" />
                  <circle cx={5 + graphDepthRatio*90} cy={graphDepthRatio < 0.2 ? 5 : (graphDepthRatio < 0.6 ? 20 : 35)} r="2" fill="#fff" />
               </svg>
            </div>
          </div>
        </>
      )}

      <hr className="divider" />

      {/* Depth Slider or Origin Label */}
      <div className="panel-section">
        {isSurface ? (
          <div className="surface-info-block">
             <div className="section-label">OBSERVATION SOURCE</div>
             <div className="sensor-source">MULTI-SOURCE OCEAN DATA</div>
             <div className="source-desc">OceanEmbed combines satellite observations and ocean-model analysis to provide surface ocean conditions.</div>
          </div>
        ) : (
          <>
            <div className="section-row">
              <div className="section-label">DEPTH</div>
              <div className="slider-value">{depth}m <span>{currentSourceDisplay}</span></div>
            </div>
            
            <div className="slider-wrapper">
              <span className="bound">0m</span>
              <input 
                type="range" 
                min="0" max="1000" step="10" 
                value={depth} 
                onChange={(e) => setDepth(Number(e.target.value))} 
                className="depth-range"
              />
              <span className="bound">1000m</span>
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

        .panel-mode-selector button:hover {
          color: #fff;
          border-color: rgba(120, 203, 233, 0.3);
        }

        .panel-mode-selector button.active {
          background: rgba(120, 203, 233, 0.1);
          border-color: #7ce0d0;
          color: #fff;
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
        
          .metric-source {
            color: rgba(124, 224, 208, 0.78);
            font-size: 0.62rem;
            letter-spacing: 0.04em;
            line-height: 1.35;
          }
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
      `}</style>
    </div>
  );
}
