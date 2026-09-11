'use client';

import React, { useEffect, useState, useRef } from 'react';
import * as d3Geo from 'd3-geo';
import { ModelResultsProvider } from '@/data/ModelResultsProvider';

// Decorative depth-tinted gradients — purely atmospheric styling driven by
// the selected depth/mode, not a rendering of any real per-pixel dataset.
const surfaceHeatStyle = {
  stop0: '#d13824', stop50: '#e28c31', stop100: '#15799e'
};
const deepHeatStyle = {
  stop0: '#15799e', stop50: '#083c61', stop100: '#031124'
};

// Screen-space radius (in the 800x500 viewBox) within which a pointer
// counts as "on" a marker, for both hover and click.
const MARKER_HIT_RADIUS = 18;

export default function RealOceanMap({ depth, isSurface, selectedId, setSelectedId, locations }) {
  const [mapPath, setMapPath] = useState('');
  const [hoverMarker, setHoverMarker] = useState(null);
  const [resultsById, setResultsById] = useState({});

  const svgRef = useRef(null);
  const projectionRef = useRef(null);

  useEffect(() => {
    fetch('/data/indianOcean.geojson')
      .then(res => res.json())
      .then(topology => {
        // Tight projection over India, Bay of Bengal, Arabian Sea, and Indian Ocean
        const projection = d3Geo.geoEquirectangular()
          .center([77.5, -2.5])
          .scale(600)
          .translate([400, 250]);

        projectionRef.current = projection;
        const geoGenerator = d3Geo.geoPath().projection(projection);
        setMapPath(geoGenerator(topology));
      })
      .catch(e => console.error("Could not load world map", e));
  }, []);

  useEffect(() => {
    async function loadResults() {
      await ModelResultsProvider.load();
      const byId = {};
      locations.forEach(loc => { byId[loc.id] = ModelResultsProvider.getResultById(loc.id); });
      setResultsById(byId);
    }
    if (locations.length > 0) loadResults();
  }, [locations]);

  const heatStyle = (isSurface && depth < 200) ? surfaceHeatStyle : deepHeatStyle;
  const opacity = Math.max(0.2, 1 - (depth / 1000));

  // Screen (viewBox-space) coordinates for a pointer event, accounting for
  // letterboxing between the 800x500 viewBox and the rendered element —
  // also returns the inverse-projected lat/lon at that point.
  const getMapCoordinates = (e) => {
    if (!svgRef.current || !projectionRef.current) return null;

    const rect = svgRef.current.getBoundingClientRect();
    const viewBoxWidth = 800;
    const viewBoxHeight = 500;
    const scale = Math.min(rect.width / viewBoxWidth, rect.height / viewBoxHeight);
    const renderedWidth = viewBoxWidth * scale;
    const renderedHeight = viewBoxHeight * scale;
    const offsetX = (rect.width - renderedWidth) / 2;
    const offsetY = (rect.height - renderedHeight) / 2;
    const x = (e.clientX - rect.left - offsetX) / scale;
    const y = (e.clientY - rect.top - offsetY) / scale;

    if (x < 0 || x > viewBoxWidth || y < 0 || y > viewBoxHeight) return null;

    const inverted = projectionRef.current.invert([x, y]);
    if (!inverted) return null;

    const [lon, lat] = inverted;
    return { lat, lon, x, y };
  };

  // Projected screen position for each of the 5 real locations.
  const markers = projectionRef.current
    ? locations.map(loc => {
        const p = projectionRef.current([loc.lon, loc.lat]);
        return p ? { ...loc, x: p[0], y: p[1] } : null;
      }).filter(Boolean)
    : [];

  const findNearestMarker = (x, y) => {
    let nearest = null;
    let nearestDist = MARKER_HIT_RADIUS;
    markers.forEach(m => {
      const dist = Math.hypot(m.x - x, m.y - y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = m;
      }
    });
    return nearest;
  };

  const handlePointer = (e) => {
    if (e.target.classList.contains('land-mass')) {
      setHoverMarker(null);
      return;
    }

    const coordinates = getMapCoordinates(e);
    if (!coordinates) {
      setHoverMarker(null);
      return;
    }

    setHoverMarker(findNearestMarker(coordinates.x, coordinates.y));
  };

  const handlePointerLeave = () => {
    setHoverMarker(null);
  };

  const handleClick = (e) => {
    if (e.target.classList.contains('land-mass')) return;

    const coordinates = getMapCoordinates(e);
    if (!coordinates) return;

    const nearest = findNearestMarker(coordinates.x, coordinates.y);
    if (nearest) setSelectedId(nearest.id);
  };

  const selectedMarker = markers.find(m => m.id === selectedId) || null;
  const hoverResult = hoverMarker ? resultsById[hoverMarker.id] : null;

  return (
    <div className="ocean-map-container">
      <div className="map-controls">
        <button>+</button>
        <button>−</button>
        <button className="reset">RESET</button>
      </div>

      <div className="map-canvas">
        <svg
           ref={svgRef}
           viewBox="0 0 800 500"
           className={`d3-svg ${hoverMarker ? 'interactive-ocean' : ''}`}
           preserveAspectRatio="xMidYMid meet"
           onMouseMove={handlePointer}
           onMouseLeave={handlePointerLeave}
           onClick={handleClick}
        >
           <defs>
             <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
               <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#15799e" strokeWidth="0.2" opacity="0.3" />
             </pattern>

             <radialGradient id="ocean-heat" cx="60%" cy="45%" r="35%">
               <stop offset="0%" stopColor={heatStyle.stop0} stopOpacity={opacity * 0.8} />
               <stop offset="50%" stopColor={heatStyle.stop50} stopOpacity={opacity * 0.5} />
               <stop offset="100%" stopColor={heatStyle.stop100} stopOpacity="0" />
             </radialGradient>

             <radialGradient id="ocean-heat-2" cx="30%" cy="65%" r="20%">
               <stop offset="0%" stopColor={heatStyle.stop50} stopOpacity={opacity * 0.6} />
               <stop offset="100%" stopColor={heatStyle.stop100} stopOpacity="0" />
             </radialGradient>
           </defs>

           <rect width="800" height="500" fill="url(#grid)" />

           {/* Ocean Base color */}
           <rect width="800" height="500" fill="#031124" className="ocean-receptor" />
           <rect width="800" height="500" fill="url(#ocean-heat)" className="ocean-receptor" style={{ transition: 'all 0.5s ease', opacity: isSurface ? 0 : 1 }} />
           <rect width="800" height="500" fill="url(#ocean-heat-2)" className="ocean-receptor" style={{ transition: 'all 0.5s ease', opacity: isSurface ? 0 : 1 }} />

           {/* Topographical Path for Continents */}
           {mapPath && (
             <path d={mapPath} className="land-mass" />
           )}

           {/* The 5 real model-output locations */}
           {markers.map(m => (
             <g
               key={m.id}
               className={`observation-node ${m.id === selectedId ? 'selected' : ''}`}
               transform={`translate(${m.x}, ${m.y})`}
             >
               {m.id === selectedId && (
                 <>
                   <circle r="45" fill="#7ce0d0" opacity="0.05" />
                   <circle r="25" fill="#7ce0d0" opacity="0.1" />
                 </>
               )}
               <circle r={m.id === selectedId ? "4" : "3"} fill={m.id === selectedId ? "#7ce0d0" : "#78CBE9"} className={m.id === selectedId ? "sonar-ping" : ""} />
               <circle r="1.5" fill="#fff" />
             </g>
           ))}

           {/* Dynamic Tooltip following the nearest marker under the pointer */}
           {hoverMarker && (
             <g transform={`translate(${hoverMarker.x + 15}, ${hoverMarker.y + 15})`} style={{ pointerEvents: 'none' }}>
               <rect width="130" height="90" fill="rgba(1, 7, 14, 0.9)" stroke="#3bb3cb" strokeWidth="0.5" rx="2" />
               <text x="10" y="18" fill="#78CBE9" fontSize="7" letterSpacing="0.05em">LOCATION</text>
               <text x="10" y="32" fill="#fff" fontSize="9" fontWeight="bold">{hoverMarker.lat >= 0 ? `${hoverMarker.lat}°N` : `${Math.abs(hoverMarker.lat)}°S`} • {hoverMarker.lon >= 0 ? `${hoverMarker.lon}°E` : `${Math.abs(hoverMarker.lon)}°W`}</text>
               <text x="10" y="44" fill="#7ce0d0" fontSize="7">{hoverMarker.region}</text>

               <text x="10" y="60" fill="#78CBE9" fontSize="7" letterSpacing="0.05em">PREDICTED SST</text>
               <text x="10" y="74" fill="#fff" fontSize="9" fontWeight="bold">
                 {hoverResult ? `${hoverResult.surface_state.sst_c.toFixed(2)}°C` : "…"}
               </text>
             </g>
           )}

        </svg>
      </div>

      <style>{`
        .ocean-map-container {
          position: relative;
          width: 100%;
          height: 100%;
          border: 1px solid rgba(120, 203, 233, 0.15);
          border-radius: 4px;
          background: #01070e;
          overflow: hidden;
          box-shadow: 0 4px 30px rgba(1, 7, 14, 0.5);
        }

        .map-controls {
          position: absolute;
          top: 1.5rem;
          right: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          z-index: 10;
        }

        .map-controls button {
          background: rgba(4, 21, 38, 0.8);
          border: 1px solid rgba(120, 203, 233, 0.2);
          color: #78CBE9;
          backdrop-filter: blur(4px);
          font-family: var(--font-space-grotesk), sans-serif;
          cursor: pointer;
          border-radius: 2px;
          width: 28px;
          height: 28px;
          font-size: 1.2rem;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }

        .map-controls button.reset {
          font-size: 0.5rem;
          letter-spacing: 0.1em;
          font-weight: 600;
          height: auto;
          width: auto;
          padding: 0.4rem 0.5rem;
          margin-top: 0.5rem;
        }

        .map-controls button:hover {
          background: rgba(120, 203, 233, 0.15);
          color: #fff;
        }

        .map-canvas {
          position: absolute;
          inset: 0;
        }

        .d3-svg {
          width: 100%;
          height: 100%;
        }

        .interactive-ocean {
          cursor: pointer;
        }

        .land-mass {
          fill: #061e33;
          stroke: #104c73;
          stroke-width: 0.5;
          pointer-events: auto; /* Swallows mouse events above ocean */
        }

        .land-mass:hover {
          cursor: default;
        }

        .observation-node circle {
          transition: r 0.2s ease;
        }

        .sonar-ping {
          animation: ping 2s infinite ease-out;
        }

        @keyframes ping {
          0% { stroke: #7ce0d0; stroke-width: 0; opacity: 1; }
          100% { stroke: #7ce0d0; stroke-width: 15; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
