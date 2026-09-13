'use client';

import React, { useEffect, useState, useRef } from 'react';
import * as d3Geo from 'd3-geo';

export default function OceanLocationMap({
  mode = 'single', // 'single' or 'route'
  selectedLocation = { lat: 15.0, lon: 64.96, regionName: 'Arabian Sea Core' },
  onLocationSelect = (_loc) => {}, // (location) => void
  originLocation = null, // for route mode { lat, lon, label }
  destinationLocation = null, // for route mode { lat, lon, label }
  onRouteSelect = () => {}, // for route mode ({ origin, destination }) => void
  routeSamples = [], // [{ lat, lon, alongRouteCurrent, valid }]
  greatCircleSamples = [], // [{ lat, lon }] reference arc
  routeStep = 'origin', // 'origin' | 'destination'
  onStepChange = (_step) => {},
  onResetRoute = () => {}, // () => void
  presets = [], // [{ key, name, lat, lon, regionName }]
  activePresetKey = "",
  onPresetSelect = (_p) => {},
  title = "INTERACTIVE OCEAN LOCATION SELECTOR"
}) {
  const [mapPath, setMapPath] = useState('');
  const [hoverLocation, setHoverLocation] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  // Expanded Indian Ocean default viewport (35°E → 110°E, 35°S → 30°N)
  const [zoomScale, setZoomScale] = useState(720);
  const [zoomCenter, setZoomCenter] = useState([72.5, -1.5]);

  const svgRef = useRef(null);
  const projectionRef = useRef(null);
  const topologyRef = useRef(null);

  const updateProjection = (scale, center, topology) => {
    const projection = d3Geo.geoEquirectangular()
      .center(center)
      .scale(scale)
      .translate([400, 250]);
    projectionRef.current = projection;

    if (topology) {
      const geoGenerator = d3Geo.geoPath().projection(projection);
      setMapPath(geoGenerator(topology));
    }
  };

  useEffect(() => {
    fetch('/data/indianOcean.geojson')
      .then(res => res.json())
      .then(topology => {
        topologyRef.current = topology;
        updateProjection(zoomScale, zoomCenter, topology);
      })
      .catch(e => console.error("Could not load ocean map topology", e));
  }, []);

  const handleZoomIn = () => {
    const newScale = Math.min(zoomScale * 1.35, 2800);
    setZoomScale(newScale);
    updateProjection(newScale, zoomCenter, topologyRef.current);
  };

  const handleZoomOut = () => {
    const newScale = Math.max(zoomScale / 1.35, 450);
    setZoomScale(newScale);
    updateProjection(newScale, zoomCenter, topologyRef.current);
  };

  const handleResetZoom = () => {
    setZoomScale(720);
    setZoomCenter([72.5, -1.5]);
    updateProjection(720, [72.5, -1.5], topologyRef.current);
  };

  const getMapCoordinates = (e) => {
    if (!svgRef.current || !projectionRef.current) return null;

    const point = svgRef.current.createSVGPoint();
    point.x = e.clientX;
    point.y = e.clientY;

    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return null;

    const svgPoint = point.matrixTransform(ctm.inverse());
    const x = svgPoint.x;
    const y = svgPoint.y;

    if (x < 0 || x > 800 || y < 0 || y > 500) return null;

    const inverted = projectionRef.current.invert([x, y]);
    if (!inverted) return null;

    const [lon, lat] = inverted;

    // Check if point lands on land geometry
    let isLand = e.target.classList.contains('land-mass');
    if (!isLand && topologyRef.current) {
      isLand = d3Geo.geoContains(topologyRef.current, [lon, lat]);
    }

    // Coverage check: Indian Ocean operational region (35°E–110°E, 35°S–30°N)
    const inCoverage = lat >= -35 && lat <= 30 && lon >= 35 && lon <= 110;

    let regionName = 'Indian Ocean';
    if (lat > 5 && lon < 75) regionName = 'Arabian Sea';
    else if (lat > 5 && lon > 80) regionName = 'Bay of Bengal';
    else if (lat <= 5 && lat >= -10 && lon < 50) regionName = 'East Africa / Swahili Coast';
    else if (lat <= 5 && lat >= -10) regionName = 'Equatorial Indian Ocean';

    return { lat, lon, x, y, regionName, inCoverage, isLand };
  };

  const handlePointerMove = (e) => {
    const coords = getMapCoordinates(e);
    if (!coords || coords.isLand) {
      setHoverLocation(null);
      return;
    }

    setHoverLocation({
      ...coords,
      displayLat: parseFloat(coords.lat.toFixed(2)),
      displayLon: parseFloat(coords.lon.toFixed(2))
    });
  };

  const handlePointerLeave = () => {
    setHoverLocation(null);
  };

  const handleClick = (e) => {
    const coords = getMapCoordinates(e);
    if (!coords) return;

    if (coords.isLand) {
      setStatusMessage('INVALID LOCATION — SELECT A WATER LOCATION');
      return;
    }

    if (!coords.inCoverage) {
      setStatusMessage('Selected location is outside Indian Ocean operational coverage (35°E–110°E, 35°S–30°N).');
    } else {
      setStatusMessage('');
    }

    const newLoc = {
      lat: parseFloat(coords.lat.toFixed(4)),
      lon: parseFloat(coords.lon.toFixed(4)),
      regionName: coords.regionName,
      inCoverage: coords.inCoverage
    };

    if (mode === 'single') {
      if (onLocationSelect) onLocationSelect(newLoc);
    } else if (mode === 'route') {
      if (routeStep === 'origin' || !originLocation) {
        if (onRouteSelect) onRouteSelect({ origin: newLoc, destination: destinationLocation });
        if (onStepChange) onStepChange('destination');
      } else {
        if (onRouteSelect) onRouteSelect({ origin: originLocation, destination: newLoc });
        if (onStepChange) onStepChange('origin');
      }
    }
  };

  const projectCoords = (loc) => {
    if (!loc || !projectionRef.current) return null;
    const pt = projectionRef.current([loc.lon, loc.lat]);
    if (!pt) return null;
    return { x: pt[0], y: pt[1] };
  };

  const singlePt = mode === 'single' ? projectCoords(selectedLocation) : null;
  const originPt = mode === 'route' ? projectCoords(originLocation) : null;
  const destPt = mode === 'route' ? projectCoords(destinationLocation) : null;

  // Project route sample points
  const projectedSamples = mode === 'route' && routeSamples ? routeSamples.map(sample => {
    const pt = projectCoords(sample);
    return pt ? { ...sample, px: pt.x, py: pt.y } : null;
  }).filter(Boolean) : [];

  // Project Great-Circle reference arc points
  const projectedGreatCircle = mode === 'route' && greatCircleSamples ? greatCircleSamples.map(sample => {
    const pt = projectCoords(sample);
    return pt ? { ...sample, px: pt.x, py: pt.y } : null;
  }).filter(Boolean) : [];

  return (
    <div className="ocean-location-map-container">
      <div className="map-top-bar">
        <div className="map-title-row">
          <span className="map-title-lbl">{title}</span>
          <span className="map-hint-lbl">
            {mode === 'route'
              ? (routeStep === 'origin' ? 'CLICK WATER LOCATION TO SET ORIGIN A' : 'CLICK WATER LOCATION TO SET DESTINATION B')
              : 'CLICK ANY OCEAN LOCATION TO UPDATE ANALYSIS'}
          </span>
        </div>

        <div className="map-actions-row">
          {mode === 'route' && onResetRoute && (
            <button
              className="reset-route-btn"
              onClick={() => {
                setStatusMessage('');
                onResetRoute();
              }}
            >
              CLEAR ROUTE
            </button>
          )}

          {presets && presets.length > 0 && (
            <div className="map-presets">
              <span className="presets-lbl">PRESETS:</span>
              {presets.map(p => (
                <button
                  key={p.key}
                  className={`preset-btn ${activePresetKey === p.key ? 'active' : ''}`}
                  onClick={() => {
                    if (onPresetSelect) onPresetSelect(p);
                    else if (onLocationSelect) onLocationSelect(p);
                  }}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="map-canvas-wrapper">
        <svg
          ref={svgRef}
          viewBox="0 0 800 500"
          className="ocean-map-svg"
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handlePointerMove}
          onMouseLeave={handlePointerLeave}
          onClick={handleClick}
        >
          <defs>
            <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#15799e" strokeWidth="0.2" opacity="0.3" />
            </pattern>
          </defs>

          {/* Grid Background */}
          <rect width="800" height="500" fill="url(#gridPattern)" />
          <rect width="800" height="500" fill="#031124" className="ocean-receptor" />

          {/* Land Mass Polygon */}
          {mapPath && <path d={mapPath} className="land-mass" />}

          {/* Geographic Basin Labels */}
          {projectionRef.current && (
            <g className="geo-labels-layer" style={{ pointerEvents: 'none' }}>
              {(() => {
                const africaPt = projectionRef.current([42.0, -10.0]);
                const arabianPt = projectionRef.current([64.5, 15.5]);
                const bayPt = projectionRef.current([88.5, 15.5]);
                const oceanPt = projectionRef.current([75.0, -5.0]);
                const lankaPt = projectionRef.current([81.2, 7.2]);
                return (
                  <>
                    {africaPt && (
                      <text x={africaPt[0]} y={africaPt[1]} fill="rgba(120, 203, 233, 0.28)" fontSize="10" fontWeight="700" letterSpacing="0.14em" textAnchor="middle">
                        EAST AFRICA
                      </text>
                    )}
                    {arabianPt && (
                      <text x={arabianPt[0]} y={arabianPt[1]} fill="rgba(120, 203, 233, 0.32)" fontSize="11" fontWeight="700" letterSpacing="0.14em" textAnchor="middle">
                        ARABIAN SEA
                      </text>
                    )}
                    {bayPt && (
                      <text x={bayPt[0]} y={bayPt[1]} fill="rgba(120, 203, 233, 0.32)" fontSize="11" fontWeight="700" letterSpacing="0.14em" textAnchor="middle">
                        BAY OF BENGAL
                      </text>
                    )}
                    {lankaPt && (
                      <text x={lankaPt[0]} y={lankaPt[1]} fill="rgba(120, 203, 233, 0.35)" fontSize="8" fontWeight="600" letterSpacing="0.08em" textAnchor="middle">
                        SRI LANKA
                      </text>
                    )}
                    {oceanPt && (
                      <text x={oceanPt[0]} y={oceanPt[1]} fill="rgba(120, 203, 233, 0.25)" fontSize="10" fontWeight="700" letterSpacing="0.18em" textAnchor="middle">
                        INDIAN OCEAN
                      </text>
                    )}
                  </>
                );
              })()}
            </g>
          )}

          {/* Single Mode Selected Location Marker */}
          {mode === 'single' && singlePt && (
            <g className="map-marker-node" transform={`translate(${singlePt.x}, ${singlePt.y})`}>
              <circle r="22" fill="#7ce0d0" opacity="0.1" />
              <circle r="4.5" fill="#7ce0d0" className="sonar-ping" />
              <circle r="2" fill="#fff" />
              <text x="8" y="-8" fill="#7ce0d0" fontSize="9" fontWeight="700">
                {selectedLocation.lat >= 0 ? `${selectedLocation.lat.toFixed(2)}°N` : `${Math.abs(selectedLocation.lat).toFixed(2)}°S`}, {selectedLocation.lon >= 0 ? `${selectedLocation.lon.toFixed(2)}°E` : `${Math.abs(selectedLocation.lon).toFixed(2)}°W`}
              </text>
            </g>
          )}

          {/* Route Mode Markers & Path Lines */}
          {mode === 'route' && (
            <g className="route-layer">
              {/* Great-Circle Reference Arc (dashed gray line) */}
              {projectedGreatCircle.length > 1 && (
                <path
                  d={projectedGreatCircle.map((s, idx) => `${idx === 0 ? 'M' : 'L'} ${s.px} ${s.py}`).join(' ')}
                  fill="none"
                  stroke="rgba(222, 244, 252, 0.3)"
                  strokeWidth="1"
                  strokeDasharray="2 3"
                />
              )}

              {/* Analyzed Water Route (solid cyan line) */}
              {projectedSamples.length > 1 && (
                <path
                  d={projectedSamples.map((s, idx) => `${idx === 0 ? 'M' : 'L'} ${s.px} ${s.py}`).join(' ')}
                  fill="none"
                  stroke="#7ce0d0"
                  strokeWidth="2.5"
                  opacity="0.9"
                />
              )}

              {/* Sample points dots */}
              {projectedSamples.map((s, idx) => {
                if (idx === 0 || idx === projectedSamples.length - 1) return null;
                const isAssisting = s.alongRouteCurrent !== null && s.alongRouteCurrent > 0.05;
                const isOpposing = s.alongRouteCurrent !== null && s.alongRouteCurrent < -0.05;
                const dotColor = !s.valid ? 'rgba(222, 244, 252, 0.3)' : isAssisting ? '#7ce0d0' : isOpposing ? '#f3c98b' : '#78CBE9';

                return (
                  <circle
                    key={idx}
                    cx={s.px}
                    cy={s.py}
                    r="2.5"
                    fill={dotColor}
                    stroke="#01070e"
                    strokeWidth="0.5"
                  />
                );
              })}

              {/* ORIGIN A MARKER (Cyan) */}
              {originPt && (
                <g transform={`translate(${originPt.x}, ${originPt.y})`}>
                  <circle r="16" fill="#7ce0d0" opacity="0.2" />
                  <circle r="6" fill="#7ce0d0" stroke="#01070e" strokeWidth="1.5" />
                  <text x="0" y="2.5" fill="#01070e" fontSize="7" fontWeight="900" textAnchor="middle">A</text>
                  <text x="9" y="-8" fill="#7ce0d0" fontSize="9" fontWeight="700">
                    A (ORIGIN)
                  </text>
                </g>
              )}

              {/* DESTINATION B MARKER (Warm Accent) */}
              {destPt && (
                <g transform={`translate(${destPt.x}, ${destPt.y})`}>
                  <circle r="16" fill="#f3c98b" opacity="0.2" />
                  <circle r="6" fill="#f3c98b" stroke="#01070e" strokeWidth="1.5" />
                  <text x="0" y="2.5" fill="#01070e" fontSize="7" fontWeight="900" textAnchor="middle">B</text>
                  <text x="9" y="-8" fill="#f3c98b" fontSize="9" fontWeight="700">
                    B (DESTINATION)
                  </text>
                </g>
              )}
            </g>
          )}

          {/* Hover Location Tooltip */}
          {hoverLocation && (
            <g transform={`translate(${hoverLocation.x + 12}, ${hoverLocation.y + 12})`} style={{ pointerEvents: 'none' }}>
              <rect width="115" height="42" fill="rgba(1, 7, 14, 0.92)" stroke="#78CBE9" strokeWidth="0.5" rx="3" />
              <text x="8" y="16" fill="#78CBE9" fontSize="7" fontWeight="600" letterSpacing="0.08em">CLICK TO SELECT</text>
              <text x="8" y="30" fill="#fff" fontSize="9" fontWeight="700">
                {hoverLocation.displayLat >= 0 ? `${hoverLocation.displayLat}°N` : `${Math.abs(hoverLocation.displayLat)}°S`} • {hoverLocation.displayLon >= 0 ? `${hoverLocation.displayLon}°E` : `${Math.abs(hoverLocation.displayLon)}°W`}
              </text>
            </g>
          )}
        </svg>

        {/* Map Upper-Right Zoom & Reset View Controls */}
        <div className="map-zoom-controls">
          <button className="zoom-btn" onClick={handleZoomIn} title="Zoom In">+</button>
          <button className="zoom-btn" onClick={handleZoomOut} title="Zoom Out">−</button>
          <button className="zoom-btn reset-zoom" onClick={handleResetZoom} title="Reset Viewport">RESET VIEW</button>
        </div>
      </div>

      {/* Coordinate & Status Footer Bar */}
      <div className="map-footer-bar">
        <div className="coord-readout">
          <span className="coord-lbl">COORDINATE READOUT:</span>
          {mode === 'single' && selectedLocation ? (
            <span className="coord-val">
              {selectedLocation.lat >= 0 ? `${selectedLocation.lat.toFixed(2)}° N` : `${Math.abs(selectedLocation.lat).toFixed(2)}° S`},{' '}
              {selectedLocation.lon >= 0 ? `${selectedLocation.lon.toFixed(2)}° E` : `${Math.abs(selectedLocation.lon).toFixed(2)}° W`}
              <span className="region-pill">{selectedLocation.regionName}</span>
            </span>
          ) : mode === 'route' && (originLocation || destinationLocation) ? (
            <span className="coord-val">
              ORIGIN A: {originLocation ? `${originLocation.lat.toFixed(2)}°N, ${originLocation.lon.toFixed(2)}°E` : 'NOT SET'} |{' '}
              DESTINATION B: {destinationLocation ? `${destinationLocation.lat.toFixed(2)}°N, ${destinationLocation.lon.toFixed(2)}°E` : 'NOT SET'}
            </span>
          ) : (
            <span className="coord-val text-muted">Click ocean location on map</span>
          )}
        </div>

        {statusMessage && <span className="status-msg">{statusMessage}</span>}
      </div>

      <style>{`
        .ocean-location-map-container {
          background: rgba(1, 9, 21, 0.7);
          border: 1px solid rgba(120, 203, 233, 0.2);
          border-radius: 4px;
          padding: 0.9rem;
          margin-bottom: 1.2rem;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }
        .map-top-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.6rem;
          border-bottom: 1px solid rgba(120, 203, 233, 0.12);
          padding-bottom: 0.6rem;
        }
        .map-title-row {
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
        }
        .map-title-lbl {
          font: 700 0.65rem var(--font-space-grotesk), sans-serif;
          color: #7ce0d0;
          letter-spacing: 0.12em;
        }
        .map-hint-lbl {
          font: 600 0.58rem var(--font-public-sans), sans-serif;
          color: rgba(120, 203, 233, 0.75);
          letter-spacing: 0.08em;
        }
        .map-actions-row {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        .reset-route-btn {
          background: rgba(243, 201, 139, 0.15);
          border: 1px solid rgba(243, 201, 139, 0.4);
          color: #f3c98b;
          font: 600 0.65rem var(--font-space-grotesk), sans-serif;
          padding: 0.25rem 0.6rem;
          border-radius: 2px;
          cursor: pointer;
          transition: all 0.2s ease;
          letter-spacing: 0.06em;
        }
        .reset-route-btn:hover {
          background: rgba(243, 201, 139, 0.28);
          border-color: #f3c98b;
          color: #fff;
        }
        .map-presets {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        .presets-lbl {
          font: 600 0.58rem var(--font-public-sans), sans-serif;
          color: rgba(120, 203, 233, 0.6);
          letter-spacing: 0.08em;
        }
        .preset-btn {
          background: rgba(8, 60, 97, 0.4);
          border: 1px solid rgba(120, 203, 233, 0.2);
          color: rgba(234, 247, 255, 0.85);
          font: 500 0.7rem var(--font-space-grotesk), sans-serif;
          padding: 0.25rem 0.55rem;
          border-radius: 2px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .preset-btn:hover {
          border-color: #7ce0d0;
          color: #fff;
        }
        .preset-btn.active {
          background: rgba(124, 224, 208, 0.18);
          border-color: #7ce0d0;
          color: #7ce0d0;
          font-weight: 600;
        }
        .map-canvas-wrapper {
          width: 100%;
          height: 420px;
          background: #01070e;
          border: 1px solid rgba(120, 203, 233, 0.15);
          border-radius: 3px;
          overflow: hidden;
          position: relative;
        }
        .ocean-map-svg {
          width: 100%;
          height: 100%;
          cursor: crosshair;
        }
        .land-mass {
          fill: #061e33;
          stroke: #104c73;
          stroke-width: 0.5;
          pointer-events: auto;
        }
        .land-mass:hover {
          cursor: not-allowed;
        }
        .map-zoom-controls {
          position: absolute;
          top: 10px;
          right: 10px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          z-index: 10;
        }
        .zoom-btn {
          background: rgba(1, 9, 21, 0.85);
          border: 1px solid rgba(120, 203, 233, 0.3);
          color: #7ce0d0;
          font: 700 0.8rem var(--font-space-grotesk), monospace;
          width: 26px;
          height: 26px;
          border-radius: 3px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
          padding: 0;
        }
        .zoom-btn:hover {
          background: rgba(124, 224, 208, 0.2);
          border-color: #7ce0d0;
          color: #fff;
        }
        .zoom-btn.reset-zoom {
          width: auto;
          padding: 0 0.4rem;
          font-size: 0.58rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: #f3c98b;
          border-color: rgba(243, 201, 139, 0.4);
          height: 22px;
        }
        .zoom-btn.reset-zoom:hover {
          background: rgba(243, 201, 139, 0.25);
          color: #fff;
        }
        .sonar-ping {
          animation: mapPing 2s infinite ease-out;
        }
        @keyframes mapPing {
          0% { stroke: #7ce0d0; stroke-width: 0; opacity: 1; }
          100% { stroke: #7ce0d0; stroke-width: 12; opacity: 0; }
        }
        .map-footer-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .coord-readout {
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        .coord-lbl {
          font: 600 0.6rem var(--font-public-sans), sans-serif;
          color: rgba(120, 203, 233, 0.65);
          letter-spacing: 0.08em;
        }
        .coord-val {
          font: 700 0.85rem var(--font-space-grotesk), sans-serif;
          color: #fff;
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }
        .coord-val.text-muted {
          color: rgba(222, 244, 252, 0.5);
          font-weight: 500;
          font-style: italic;
          font-size: 0.78rem;
        }
        .region-pill {
          background: rgba(120, 203, 233, 0.15);
          color: #78CBE9;
          border: 1px solid rgba(120, 203, 233, 0.3);
          font: 600 0.6rem var(--font-space-grotesk), sans-serif;
          padding: 0.1rem 0.45rem;
          border-radius: 2px;
          letter-spacing: 0.04em;
        }
        .status-msg {
          font-size: 0.75rem;
          color: #f3c98b;
          font-style: italic;
          font-weight: 600;
        }
      `}</style>
    </div>
  );
}
