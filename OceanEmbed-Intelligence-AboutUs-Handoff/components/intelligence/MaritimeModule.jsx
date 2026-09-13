'use client';

import React, { useState, useEffect } from 'react';
import OceanLocationMap from './OceanLocationMap';
import { RealCurrentDataProvider } from '@/data/RealCurrentDataProvider';
import { RealGLORYSDataProvider } from '@/data/RealGLORYSDataProvider';
import {
  calculateGeodesicDistance,
  sampleGreatCircleRoute,
  sampleWaterConstrainedRoute,
  calculateAlongRouteCurrent
} from '@/lib/geodesicRoute';

export default function MaritimeModule() {
  const [originLocation, setOriginLocation] = useState({
    lat: 18.52,
    lon: 72.85,
    regionName: 'Mumbai Port Offshore'
  });
  
  const [destinationLocation, setDestinationLocation] = useState({
    lat: 13.08,
    lon: 80.27,
    regionName: 'Chennai Offshore Corridor'
  });

  const [routeStep, setRouteStep] = useState('origin'); // 'origin' | 'destination'
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [routeAnalysis, setRouteAnalysis] = useState(null);

  const evaluateRoute = async () => {
    if (!originLocation || !destinationLocation) {
      setRouteAnalysis(null);
      return;
    }

    setIsAnalyzing(true);

    await Promise.all([
      RealCurrentDataProvider.load(),
      RealGLORYSDataProvider.load()
    ]);

    // Direct Great-Circle reference line
    const rawGreatCircle = sampleGreatCircleRoute(
      originLocation.lat,
      originLocation.lon,
      destinationLocation.lat,
      destinationLocation.lon,
      20
    );

    // Water-constrained route (navigates around Sri Lanka / land barriers)
    const rawWaterSamples = sampleWaterConstrainedRoute(
      originLocation.lat,
      originLocation.lon,
      destinationLocation.lat,
      destinationLocation.lon,
      24
    );

    let validCount = 0;
    let totalSpeedSum = 0;
    let totalAlongSum = 0;
    let maxAssisting = 0;
    let maxOpposing = 0;
    let assistingCount = 0;
    let opposingCount = 0;
    let primarySource = null;

    const evaluatedSamples = rawWaterSamples.map(sample => {
      const hycomCur = RealCurrentDataProvider.getCurrent(sample.lat, sample.lon);
      const glorysCur = hycomCur ? null : RealGLORYSDataProvider.getCurrent(sample.lat, sample.lon);
      const curData = hycomCur || glorysCur;

      if (curData && curData.u !== null && curData.v !== null) {
        const alongCurrent = calculateAlongRouteCurrent(curData.u, curData.v, sample.bearingDeg);
        validCount++;
        totalSpeedSum += curData.speed;
        totalAlongSum += alongCurrent;

        if (alongCurrent > 0.05) {
          assistingCount++;
          if (alongCurrent > maxAssisting) maxAssisting = alongCurrent;
        } else if (alongCurrent < -0.05) {
          opposingCount++;
          if (alongCurrent < maxOpposing) maxOpposing = alongCurrent;
        }

        if (!primarySource && curData.source) {
          primarySource = curData.source;
        }

        return {
          ...sample,
          valid: true,
          u: curData.u,
          v: curData.v,
          speed: curData.speed,
          direction: curData.direction,
          alongRouteCurrent: alongCurrent,
          source: curData.source
        };
      } else {
        return {
          ...sample,
          valid: false,
          u: null,
          v: null,
          speed: null,
          direction: null,
          alongRouteCurrent: null,
          source: null
        };
      }
    });

    // Calculate actual distance along water route segments
    let routeDistanceKm = 0;
    for (let i = 0; i < rawWaterSamples.length - 1; i++) {
      routeDistanceKm += calculateGeodesicDistance(
        rawWaterSamples[i].lat,
        rawWaterSamples[i].lon,
        rawWaterSamples[i + 1].lat,
        rawWaterSamples[i + 1].lon
      );
    }

    const gcDistanceKm = calculateGeodesicDistance(
      originLocation.lat,
      originLocation.lon,
      destinationLocation.lat,
      destinationLocation.lon
    );

    const distanceNmi = routeDistanceKm * 0.539957;

    let currentEffect = 'INSUFFICIENT DATA';
    let currentEffectClass = 'insufficient';
    let meanAlongCurrent = 0;
    let meanSpeed = 0;
    let assistingPct = 0;
    let opposingPct = 0;

    if (validCount >= 4) {
      meanSpeed = parseFloat((totalSpeedSum / validCount).toFixed(2));
      meanAlongCurrent = parseFloat((totalAlongSum / validCount).toFixed(2));
      assistingPct = Math.round((assistingCount / validCount) * 100);
      opposingPct = Math.round((opposingCount / validCount) * 100);

      if (meanAlongCurrent >= 0.08 && assistingPct >= 50) {
        currentEffect = 'FAVORABLE';
        currentEffectClass = 'favorable';
      } else if (meanAlongCurrent <= -0.08 && opposingPct >= 50) {
        currentEffect = 'OPPOSING';
        currentEffectClass = 'opposing';
      } else {
        currentEffect = 'NEUTRAL / MIXED';
        currentEffectClass = 'neutral';
      }
    }

    // Estimated transit time at standard 14 knots (25.9 km/h)
    let estTimeHours = null;
    if (routeDistanceKm > 0) {
      estTimeHours = Math.round(routeDistanceKm / 25.9);
    }

    setRouteAnalysis({
      distanceKm: Math.round(routeDistanceKm),
      gcDistanceKm: Math.round(gcDistanceKm),
      distanceNmi: Math.round(distanceNmi),
      estTimeHours,
      totalSamples: rawWaterSamples.length,
      validSamples: validCount,
      meanSpeed,
      meanAlongCurrent,
      maxAssisting: parseFloat(maxAssisting.toFixed(2)),
      maxOpposing: parseFloat(maxOpposing.toFixed(2)),
      assistingPct,
      opposingPct,
      currentEffect,
      currentEffectClass,
      primarySource: primarySource || 'HYCOM / GLORYS Analysis',
      samples: evaluatedSamples,
      greatCircleSamples: rawGreatCircle
    });
    setIsAnalyzing(false);
  };

  useEffect(() => {
    evaluateRoute();
  }, []);

  const handleRouteSelect = ({ origin, destination }) => {
    if (origin) setOriginLocation(origin);
    if (destination) setDestinationLocation(destination);
  };

  const handleClearRoute = () => {
    setOriginLocation(null);
    setDestinationLocation(null);
    setRouteAnalysis(null);
    setRouteStep('origin');
  };

  return (
    <article className="intel-card maritime-workstation">
      {/* COMPACT WORKSTATION HEADER */}
      <div className="workstation-header">
        <h2>MARITIME INTELLIGENCE</h2>
        <p className="headline">Ocean-aware route planning and decision support.</p>
      </div>

      {/* 2-COLUMN WORKSTATION LAYOUT: MAP (75%) + CONSOLE (25%) */}
      <div className="maritime-main-layout">
        {/* DOMINANT MAP WORKSPACE */}
        <div className="map-column">
          <OceanLocationMap
            mode="route"
            originLocation={originLocation}
            destinationLocation={destinationLocation}
            onRouteSelect={handleRouteSelect}
            routeSamples={routeAnalysis?.samples || []}
            greatCircleSamples={routeAnalysis?.greatCircleSamples || []}
            routeStep={routeStep}
            onStepChange={setRouteStep}
            onResetRoute={handleClearRoute}
            title="INDIAN OCEAN MARITIME WORKSPACE"
          />
        </div>

        {/* COMPACT SCIENTIFIC CONTROL CONSOLE */}
        <div className="console-column">
          {/* ROUTE PLANNING SELECTION WORKFLOW */}
          <div className="console-section">
            <div className="section-title">ROUTE PLANNING</div>
            <p className="section-hint">Select Origin (A) and Destination (B) on the map.</p>

            <div className="step-button-group">
              <button
                className={`step-btn ${routeStep === 'origin' ? 'active-step' : ''}`}
                onClick={() => setRouteStep('origin')}
              >
                {originLocation ? '✓ SET ORIGIN (A)' : 'SET ORIGIN (A)'}
              </button>
              <button
                className={`step-btn ${routeStep === 'destination' ? 'active-step' : ''}`}
                onClick={() => setRouteStep('destination')}
              >
                {destinationLocation ? '✓ SET DESTINATION (B)' : 'SET DESTINATION (B)'}
              </button>
              <button className="step-btn clear-btn" onClick={handleClearRoute}>
                CLEAR ROUTE
              </button>
            </div>
          </div>

          {/* SELECTED POINTS READOUT */}
          <div className="console-section">
            <div className="section-title">SELECTED POINTS</div>

            <div className="points-box">
              <div className="point-row">
                <span className="point-tag origin-tag">ORIGIN (A)</span>
                <span className="point-coords">
                  {originLocation ? (
                    <>
                      {originLocation.lat >= 0 ? `${originLocation.lat.toFixed(2)}° N` : `${Math.abs(originLocation.lat).toFixed(2)}° S`}
                      {' · '}
                      {originLocation.lon >= 0 ? `${originLocation.lon.toFixed(2)}° E` : `${Math.abs(originLocation.lon).toFixed(2)}° W`}
                    </>
                  ) : (
                    <em className="muted-text">NOT SET</em>
                  )}
                </span>
              </div>

              <div className="point-row">
                <span className="point-tag dest-tag">DESTINATION (B)</span>
                <span className="point-coords">
                  {destinationLocation ? (
                    <>
                      {destinationLocation.lat >= 0 ? `${destinationLocation.lat.toFixed(2)}° N` : `${Math.abs(destinationLocation.lat).toFixed(2)}° S`}
                      {' · '}
                      {destinationLocation.lon >= 0 ? `${destinationLocation.lon.toFixed(2)}° E` : `${Math.abs(destinationLocation.lon).toFixed(2)}° W`}
                    </>
                  ) : (
                    <em className="muted-text">NOT SET</em>
                  )}
                </span>
              </div>
            </div>

            <button
              className="analyze-action-btn"
              disabled={!originLocation || !destinationLocation || isAnalyzing}
              onClick={evaluateRoute}
            >
              {isAnalyzing ? 'ANALYZING ROUTE...' : 'ANALYZE ROUTE'}
            </button>
          </div>

          {/* ROUTE ANALYSIS SUMMARY */}
          {routeAnalysis ? (
            <div className="console-section results-section">
              <div className="section-title">ANALYZED ROUTE SUMMARY</div>

              <div className="metric-cards-grid">
                <div className="m-card">
                  <span className="m-lbl">DISTANCE</span>
                  <strong className="m-val">{routeAnalysis.distanceKm} km</strong>
                  <span className="m-sub">({routeAnalysis.distanceNmi} nmi)</span>
                </div>

                <div className="m-card">
                  <span className="m-lbl">EST. TIME</span>
                  <strong className="m-val">
                    {routeAnalysis.estTimeHours !== null ? `${routeAnalysis.estTimeHours} h` : 'N/A'}
                  </strong>
                  <span className="m-sub">(14 kt transit)</span>
                </div>

                <div className="m-card">
                  <span className="m-lbl">CURRENT EFFECT</span>
                  <strong className={`m-val status-${routeAnalysis.currentEffectClass}`}>
                    {routeAnalysis.currentEffect}
                  </strong>
                  <span className="m-sub">
                    {routeAnalysis.meanAlongCurrent > 0
                      ? `+${routeAnalysis.meanAlongCurrent} m/s Assist`
                      : routeAnalysis.meanAlongCurrent < 0
                      ? `${routeAnalysis.meanAlongCurrent} m/s Oppose`
                      : 'Neutral'}
                  </span>
                </div>

                <div className="m-card">
                  <span className="m-lbl">SEA CONDITIONS</span>
                  <strong className="m-val">MODERATE</strong>
                  <span className="m-sub">Open-Sea Baseline</span>
                </div>
              </div>

              {/* ROUTE BASIS CHECKLIST */}
              <div className="basis-box">
                <span className="basis-hdr">ROUTE BASIS:</span>
                <div className="basis-tags">
                  <span className="b-tag active">✓ CURRENT</span>
                  <span className="b-tag disabled">— WIND</span>
                  <span className="b-tag disabled">— WAVES</span>
                  <span className="b-tag disabled">— WEATHER</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="console-section empty-hint">
              <p>Set Origin A and Destination B to calculate water-valid route metrics.</p>
            </div>
          )}

          {/* DATA SOURCES & SCIENTIFIC DISCLAIMER */}
          <div className="console-section footer-section">
            <div className="sources-line">
              <span className="src-lbl">DATA SOURCES:</span>
              <strong className="src-val">HYCOM · GLORYS</strong>
            </div>
            <p className="disclaimer-text">
              Ocean-aware routing is decision support and not autonomous navigation.
            </p>
          </div>
        </div>
      </div>

      <style>{`
        .maritime-workstation {
          background: rgba(3, 17, 36, 0.85);
          border: 1px solid rgba(120, 203, 233, 0.2);
          border-radius: 4px;
          padding: 1.25rem;
          margin-bottom: 2rem;
          backdrop-filter: blur(8px);
        }
        .workstation-header {
          margin-bottom: 0.85rem;
        }
        .workstation-header h2 {
          color: #fff;
          font: 700 1.5rem var(--font-space-grotesk), sans-serif;
          margin: 0 0 0.1rem 0;
          letter-spacing: 0.04em;
          text-transform: uppercase;
        }
        .workstation-header .headline {
          color: rgba(222, 244, 252, 0.75);
          font: 500 0.88rem var(--font-public-sans), sans-serif;
          margin: 0;
        }
        .maritime-main-layout {
          display: grid;
          grid-template-columns: 76% 23%;
          gap: 1%;
          align-items: start;
        }
        .map-column {
          width: 100%;
        }
        .console-column {
          background: rgba(1, 9, 21, 0.75);
          border: 1px solid rgba(120, 203, 233, 0.18);
          border-radius: 3px;
          padding: 0.9rem;
          display: flex;
          flex-direction: column;
          gap: 0.9rem;
        }
        .console-section {
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          border-bottom: 1px solid rgba(120, 203, 233, 0.1);
          padding-bottom: 0.75rem;
        }
        .console-section:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }
        .section-title {
          font: 700 0.65rem var(--font-space-grotesk), sans-serif;
          color: #7ce0d0;
          letter-spacing: 0.1em;
        }
        .section-hint {
          font: 500 0.72rem var(--font-public-sans), sans-serif;
          color: rgba(222, 244, 252, 0.6);
          margin: 0;
        }
        .step-button-group {
          display: flex;
          flex-direction: column;
          gap: 0.35rem;
          margin-top: 0.2rem;
        }
        .step-btn {
          background: rgba(8, 60, 97, 0.35);
          border: 1px solid rgba(120, 203, 233, 0.25);
          color: rgba(234, 247, 255, 0.85);
          font: 600 0.68rem var(--font-space-grotesk), sans-serif;
          padding: 0.35rem 0.6rem;
          border-radius: 2px;
          cursor: pointer;
          transition: all 0.2s ease;
          letter-spacing: 0.04em;
          text-align: left;
        }
        .step-btn:hover {
          border-color: #7ce0d0;
          color: #fff;
        }
        .step-btn.active-step {
          background: rgba(124, 224, 208, 0.18);
          border-color: #7ce0d0;
          color: #7ce0d0;
        }
        .step-btn.clear-btn {
          background: rgba(243, 201, 139, 0.1);
          border-color: rgba(243, 201, 139, 0.3);
          color: #f3c98b;
          text-align: center;
          margin-top: 0.2rem;
        }
        .step-btn.clear-btn:hover {
          background: rgba(243, 201, 139, 0.25);
          color: #fff;
        }
        .points-box {
          background: rgba(8, 60, 97, 0.2);
          border: 1px solid rgba(120, 203, 233, 0.12);
          padding: 0.5rem;
          border-radius: 2px;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
        }
        .point-row {
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
        }
        .point-tag {
          font: 600 0.55rem var(--font-space-grotesk), sans-serif;
          letter-spacing: 0.08em;
        }
        .origin-tag { color: #7ce0d0; }
        .dest-tag { color: #f3c98b; }
        .point-coords {
          font: 700 0.82rem var(--font-space-grotesk), sans-serif;
          color: #fff;
        }
        .muted-text {
          color: rgba(222, 244, 252, 0.4);
          font-style: italic;
          font-weight: 400;
          font-size: 0.75rem;
        }
        .analyze-action-btn {
          background: #7ce0d0;
          color: #01070e;
          border: none;
          font: 700 0.75rem var(--font-space-grotesk), sans-serif;
          padding: 0.5rem;
          border-radius: 2px;
          cursor: pointer;
          transition: all 0.2s ease;
          letter-spacing: 0.08em;
          margin-top: 0.2rem;
        }
        .analyze-action-btn:hover:not(:disabled) {
          background: #a2f2e6;
          box-shadow: 0 0 12px rgba(124, 224, 208, 0.4);
        }
        .analyze-action-btn:disabled {
          background: rgba(120, 203, 233, 0.18);
          color: rgba(255, 255, 255, 0.35);
          cursor: not-allowed;
        }
        .metric-cards-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0.4rem;
        }
        .m-card {
          background: rgba(8, 60, 97, 0.25);
          border: 1px solid rgba(120, 203, 233, 0.1);
          padding: 0.4rem 0.5rem;
          border-radius: 2px;
          display: flex;
          flex-direction: column;
          gap: 0.1rem;
        }
        .m-lbl {
          font: 600 0.52rem var(--font-public-sans), sans-serif;
          color: rgba(120, 203, 233, 0.6);
          letter-spacing: 0.08em;
        }
        .m-val {
          font: 700 0.9rem var(--font-space-grotesk), sans-serif;
          color: #fff;
        }
        .m-val.status-favorable { color: #7ce0d0; }
        .m-val.status-opposing { color: #f3c98b; }
        .m-val.status-neutral { color: #78CBE9; }
        .m-val.status-insufficient { color: rgba(255, 255, 255, 0.5); }
        .m-sub {
          color: rgba(222, 244, 252, 0.5);
          font-size: 0.62rem;
        }
        .basis-box {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
          background: rgba(8, 60, 97, 0.15);
          padding: 0.4rem;
          border-radius: 2px;
          margin-top: 0.2rem;
        }
        .basis-hdr {
          font: 600 0.54rem var(--font-public-sans), sans-serif;
          color: rgba(120, 203, 233, 0.6);
          letter-spacing: 0.08em;
        }
        .basis-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.35rem;
        }
        .b-tag {
          font: 600 0.6rem var(--font-space-grotesk), sans-serif;
          letter-spacing: 0.04em;
        }
        .b-tag.active { color: #7ce0d0; }
        .b-tag.disabled { color: rgba(222, 244, 252, 0.35); }
        .empty-hint p {
          color: rgba(222, 244, 252, 0.5);
          font-size: 0.74rem;
          font-style: italic;
          margin: 0;
        }
        .sources-line {
          display: flex;
          gap: 0.35rem;
          align-items: center;
        }
        .src-lbl {
          font: 600 0.54rem var(--font-public-sans), sans-serif;
          color: rgba(120, 203, 233, 0.55);
          letter-spacing: 0.08em;
        }
        .src-val {
          font: 600 0.65rem var(--font-space-grotesk), sans-serif;
          color: #78CBE9;
          letter-spacing: 0.06em;
        }
        .disclaimer-text {
          font-size: 0.65rem;
          color: rgba(222, 244, 252, 0.45);
          font-style: italic;
          margin: 0;
          line-height: 1.25;
        }
        @media (max-width: 1024px) {
          .maritime-main-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </article>
  );
}
