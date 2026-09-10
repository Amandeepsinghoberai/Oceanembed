'use client';

import React, { useState, useEffect } from 'react';
import AnalysisPanel from './AnalysisPanel';
import RealOceanMap from './RealOceanMap';
import { RealSSTDataProvider } from '@/data/RealSSTDataProvider';

export default function SolutionWorkspace() {
  const [depth, setDepth] = useState(0);
  const [isSurface, setIsSurface] = useState(true);
  const [selectedDateIndex, setSelectedDateIndex] = useState(0);
  const [availableDates, setAvailableDates] = useState([]);

  // Locked map location defaults (approximate Arabian Sea coordinate)
  const [selectedLocation, setSelectedLocation] = useState({
    lat: 15.42,
    lon: 63.18,
    regionName: 'Arabian Sea'
  });

  useEffect(() => {
    async function loadDates() {
      await RealSSTDataProvider.load();
      setAvailableDates(RealSSTDataProvider.getAvailableDates());
    }
    loadDates();
  }, []);

  return (
    <section className="solution-ws-root">
      
      <div className="ws-topbar">
        <h1 className="ws-heading">REGIONAL <span className="outline-text">CONDITIONS</span></h1>
      </div>

      <div className="ws-layout">
        <div className="ws-left">
          <AnalysisPanel 
            depth={depth} 
            setDepth={setDepth} 
            isSurface={isSurface} 
            setIsSurface={setIsSurface} 
            selectedLocation={selectedLocation}
            selectedDateIndex={selectedDateIndex}
            setSelectedDateIndex={setSelectedDateIndex}
            availableDates={availableDates}
          />
        </div>
        
        <div className="ws-right">
          <RealOceanMap 
            depth={depth} 
            isSurface={isSurface} 
            selectedLocation={selectedLocation}
            setSelectedLocation={setSelectedLocation}
            selectedDateIndex={selectedDateIndex}
          />
        </div>
      </div>

      <style>{`
        .solution-ws-root {
          width: 100%;
          min-height: 100svh;
          padding-top: 80px; 
          padding-bottom: 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          color: #eefaff;
        }

        .ws-topbar {
          width: 100%;
          max-width: 1600px;
          padding: 0 clamp(1.5rem, 6vw, 6.5rem);
          margin-bottom: 1rem;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.25rem;
        }

        .ws-date-selector {
          display: none;
        }

        .dates-list {
          display: flex;
          gap: 0.5rem;
        }

        .date-btn {
          background: rgba(4, 21, 38, 0.8);
          border: 1px solid rgba(120, 203, 233, 0.2);
          color: #78CBE9;
          backdrop-filter: blur(4px);
          font-family: var(--font-inter), sans-serif;
          font-size: 0.75rem;
          padding: 0.35rem 0.75rem;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .date-btn:hover {
          background: rgba(120, 203, 233, 0.15);
          color: #fff;
        }

        .date-btn.active {
          background: rgba(120, 203, 233, 0.2);
          border-color: #7ce0d0;
          color: #fff;
          font-weight: 600;
        }

        .ws-heading {
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: clamp(3rem, 4vw, 4rem);
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1.1;
          margin: 0;
          color: #fff;
        }

        .ws-heading .outline-text {
          color: transparent;
          -webkit-text-stroke: 1.5px rgba(255, 255, 255, 0.85);
        }

        .ws-layout {
          width: 100%;
          max-width: 1600px;
          padding: 0 clamp(1.5rem, 6vw, 6.5rem);
          display: flex;
          gap: 2rem;
          flex: 1;
          min-height: 0;
        }

        .ws-left {
          flex: 0 0 38%;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .ws-right {
          flex: 0 0 calc(62% - 2rem);
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        @media (max-width: 1024px) {
          .ws-layout {
            flex-direction: column;
          }
          .ws-left, .ws-right {
            flex: inset;
            width: 100%;
          }
          .solution-ws-root {
            min-height: auto;
          }
        }
      `}</style>
    </section>
  );
}
