'use client';

import React, { useState, useEffect } from 'react';
import AnalysisPanel from './AnalysisPanel';
import RealOceanMap from './RealOceanMap';
import { ModelResultsProvider } from '@/data/ModelResultsProvider';

const DEFAULT_DEPTHS_M = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000];

export default function SolutionWorkspace() {
  const [depthIndex, setDepthIndex] = useState(0);
  const [isSurface, setIsSurface] = useState(true);
  // Default to id 0 — demo_1.json's point, per ModelResultsProvider's fixed load order.
  const [selectedId, setSelectedId] = useState(0);
  const [locations, setLocations] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);

  useEffect(() => {
    async function loadLocations() {
      await ModelResultsProvider.load();
      setLocations(ModelResultsProvider.getAllLocations());
    }
    loadLocations();
  }, []);

  useEffect(() => {
    async function loadSelected() {
      await ModelResultsProvider.load();
      setSelectedResult(ModelResultsProvider.getResultById(selectedId));
    }
    loadSelected();
  }, [selectedId]);

  // Real depth in metres for the map's decorative depth-tinted gradient —
  // derived from the selected point's own profile depths.
  const depthsM = selectedResult?.profile?.depths_m || DEFAULT_DEPTHS_M;
  const depthValueM = depthsM[Math.min(depthIndex, depthsM.length - 1)];

  return (
    <section className="solution-ws-root">

      <div className="ws-topbar">
        <h1 className="ws-heading">REGIONAL <span className="outline-text">CONDITIONS</span></h1>
      </div>

      <div className="ws-layout">
        <div className="ws-left">
          <AnalysisPanel
            depthIndex={depthIndex}
            setDepthIndex={setDepthIndex}
            isSurface={isSurface}
            setIsSurface={setIsSurface}
            selectedId={selectedId}
          />
        </div>

        <div className="ws-right">
          <RealOceanMap
            depth={depthValueM}
            isSurface={isSurface}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            locations={locations}
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
