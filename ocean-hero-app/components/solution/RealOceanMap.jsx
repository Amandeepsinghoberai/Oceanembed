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

// Real trained-model coverage — must match backend/live_predict.py's
// _classify_region exactly, so the frontend never accepts a click the
// backend would reject (or vice versa). Verified directly against the
// models' own grids: the Bay of Bengal grid's real western edge is 80°E,
// not the 77° Arabian/Bay routing threshold — 77-80°E is a real gap
// covered by neither model.
const COVERAGE_LAT_MIN = 5.0;
const COVERAGE_LAT_MAX = 30.0;
const ARABIAN_LON_MIN = 45.0;
const ARABIAN_LON_MAX = 77.0; // exclusive
const BAY_LON_COVERAGE_MIN = 80.0;
const BAY_LON_MAX = 100.0;

function classifyRegion(lat, lon) {
  if (lat < COVERAGE_LAT_MIN || lat > COVERAGE_LAT_MAX) return null;
  if (lon >= ARABIAN_LON_MIN && lon < ARABIAN_LON_MAX) return 'Arabian Sea';
  if (lon >= BAY_LON_COVERAGE_MIN && lon <= BAY_LON_MAX) return 'Bay of Bengal';
  return null;
}

// Standard sequential cool->warm temperature scale (dark blue -> blue ->
// cyan -> pale green/yellow -> orange -> red) for the real SST heatmap
// overlay. This is visual context only, never a model prediction — see
// regional_sst_grid.json's own "raw satellite reading" framing.
const SST_COLOR_STOPS = [
  [8, 37, 103],
  [40, 108, 184],
  [98, 181, 210],
  [186, 222, 165],
  [244, 216, 106],
  [232, 138, 59],
  [178, 45, 45],
];

function interpolateSstColor(t) {
  const n = SST_COLOR_STOPS.length - 1;
  const scaled = Math.min(Math.max(t, 0), 1) * n;
  const i = Math.min(Math.floor(scaled), n - 1);
  const frac = scaled - i;
  const c1 = SST_COLOR_STOPS[i];
  const c2 = SST_COLOR_STOPS[i + 1];
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * frac),
    Math.round(c1[1] + (c2[1] - c1[1]) * frac),
    Math.round(c1[2] + (c2[2] - c1[2]) * frac),
  ];
}

const SST_LEGEND_GRADIENT_CSS = `linear-gradient(90deg, ${SST_COLOR_STOPS
  .map((c, i) => `rgb(${c[0]},${c[1]},${c[2]}) ${((i / (SST_COLOR_STOPS.length - 1)) * 100).toFixed(1)}%`)
  .join(', ')})`;

export default function RealOceanMap({ depth, isSurface, selectedId, setSelectedId, arbitraryPoint, setArbitraryPoint, locations }) {
  const [mapPath, setMapPath] = useState('');
  const [hoverMarker, setHoverMarker] = useState(null);
  const [resultsById, setResultsById] = useState({});
  // Transient click feedback — a multi-marker chooser or a "no coverage"
  // notice. Both clear on the next click anywhere else on the map.
  const [chooserOptions, setChooserOptions] = useState(null);
  const [coverageNotice, setCoverageNotice] = useState(null);
  const noticeTimeoutRef = useRef(null);

  // Real, pre-fetched SST grid — visual context only, never a prediction.
  // Loaded once; a failure here must never block the rest of the map.
  const [heatmapGrid, setHeatmapGrid] = useState(null);
  const [heatmapImageUrl, setHeatmapImageUrl] = useState(null);
  const [heatmapVisible, setHeatmapVisible] = useState(true);

  const svgRef = useRef(null);
  const projectionRef = useRef(null);

  useEffect(() => {
    fetch('/data/indianOcean.geojson')
      .then(res => res.json())
      .then(topology => {
        // Tight projection over India, Bay of Bengal, Arabian Sea, and Indian Ocean.
        // translate.y is shifted down from the naive center (250) to 370 so the
        // real trained-model coverage's northern edge (30°N, both regions) stays
        // inside the 0-500 viewBox — at the old value, the whole region above
        // ~22°N (including the demo_5 marker at 23.93°N) rendered off-screen,
        // unclickable. Verified: all 5 real markers and all 8 coverage-region
        // corners now fall well inside the viewBox with margin on every edge.
        const projection = d3Geo.geoEquirectangular()
          .center([77.5, -2.5])
          .scale(600)
          .translate([400, 370]);

        projectionRef.current = projection;
        const geoGenerator = d3Geo.geoPath().projection(projection);
        setMapPath(geoGenerator(topology));
      })
      .catch(e => console.error("Could not load world map", e));
  }, []);

  // Load the real, static SST grid once. Never fetched again (no re-fetch on
  // click, no polling) — it's a periodically-refreshed snapshot, not a live
  // layer. A failure here is caught and logged; the rest of the map (markers,
  // clicking, live predictions) must keep working regardless.
  useEffect(() => {
    let cancelled = false;
    fetch('/data/regional_sst_grid.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (cancelled) return;
        let min = Infinity, max = -Infinity;
        for (const row of data.values) {
          for (const v of row) {
            if (v === null || v === undefined) continue;
            if (v < min) min = v;
            if (v > max) max = v;
          }
        }
        if (!Number.isFinite(min) || !Number.isFinite(max)) throw new Error('Grid has no non-null values');
        setHeatmapGrid({ ...data, min, max });
      })
      .catch(e => console.error('Could not load regional SST heatmap — continuing without it:', e));
    return () => { cancelled = true; };
  }, []);

  // Rasterize the grid to an offscreen canvas once both the grid and the
  // projection are ready, then use the result as a single <image> overlay —
  // far cheaper than one SVG element per cell for a 100x220 grid, and (via
  // pointer-events: none on the <image> itself, set below) never intercepts
  // a click, so markers/click-anywhere/land-mass detection are untouched.
  useEffect(() => {
    if (!heatmapGrid || !mapPath || !projectionRef.current) return;

    const { lat_min, lon_min, lat_step, lon_step, values, min, max } = heatmapGrid;
    const rows = values.length;
    const cols = rows > 0 ? values[0].length : 0;
    if (rows === 0 || cols === 0) return;

    const bleed = 60;
    const canvas = document.createElement('canvas');
    canvas.width = 800 + bleed * 2;
    canvas.height = 500 + bleed * 2;
    const ctx = canvas.getContext('2d');
    ctx.translate(bleed, bleed);

    const range = max - min || 1;
    const halfLat = lat_step / 2;
    const halfLon = lon_step / 2;

    for (let i = 0; i < rows; i++) {
      const lat = lat_min + i * lat_step;
      const row = values[i];
      for (let j = 0; j < cols; j++) {
        const value = row[j];
        if (value === null || value === undefined) continue; // land/missing — transparent, not colored

        const lon = lon_min + j * lon_step;
        const tl = projectionRef.current([lon - halfLon, lat + halfLat]);
        const br = projectionRef.current([lon + halfLon, lat - halfLat]);
        if (!tl || !br) continue;

        const [r, g, b] = interpolateSstColor((value - min) / range);
        ctx.fillStyle = `rgba(${r},${g},${b},0.72)`;

        const x0 = Math.min(tl[0], br[0]);
        const y0 = Math.min(tl[1], br[1]);
        const w = Math.abs(br[0] - tl[0]);
        const h = Math.abs(br[1] - tl[1]);
        ctx.fillRect(x0, y0, w + 0.8, h + 0.8); // +0.8 avoids subpixel seams between cells
      }
    }

    setHeatmapImageUrl(canvas.toDataURL());
  }, [heatmapGrid, mapPath]);

  useEffect(() => {
    async function loadResults() {
      await ModelResultsProvider.load();
      const byId = {};
      locations.forEach(loc => { byId[loc.id] = ModelResultsProvider.getResultById(loc.id); });
      setResultsById(byId);
    }
    if (locations.length > 0) loadResults();
  }, [locations]);

  useEffect(() => () => clearTimeout(noticeTimeoutRef.current), []);

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

  // Every known marker within hit radius — not just the nearest. Used by
  // clicks (to offer a chooser when 2+ overlap) rather than hover (which
  // only ever previews one).
  const findNearbyMarkers = (x, y) =>
    markers.filter(m => Math.hypot(m.x - x, m.y - y) < MARKER_HIT_RADIUS);

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

  const selectKnownMarker = (id) => {
    setSelectedId(id);
    setArbitraryPoint(null);
    setChooserOptions(null);
    setCoverageNotice(null);
  };

  const handleClick = (e) => {
    if (e.target.classList.contains('land-mass')) return;

    const coordinates = getMapCoordinates(e);
    if (!coordinates) return;

    clearTimeout(noticeTimeoutRef.current);
    setChooserOptions(null);
    setCoverageNotice(null);

    const nearby = findNearbyMarkers(coordinates.x, coordinates.y);

    if (nearby.length === 1) {
      selectKnownMarker(nearby[0].id);
      return;
    }

    if (nearby.length > 1) {
      // Overlapping known markers — ask which one, rather than guessing
      // (and rather than nudging their true positions apart).
      setChooserOptions({ markers: nearby, x: coordinates.x, y: coordinates.y });
      return;
    }

    // No known marker here — treat as an arbitrary point within (or
    // outside) real model coverage.
    const region = classifyRegion(coordinates.lat, coordinates.lon);
    if (!region) {
      setCoverageNotice({ x: coordinates.x, y: coordinates.y });
      noticeTimeoutRef.current = setTimeout(() => setCoverageNotice(null), 3500);
      return;
    }

    setSelectedId(null);
    setArbitraryPoint({ lat: coordinates.lat, lon: coordinates.lon, region });
  };

  const hoverResult = hoverMarker ? resultsById[hoverMarker.id] : null;

  // Screen position of the current arbitrary-point marker, if any.
  const arbitraryMarkerXY = (arbitraryPoint && projectionRef.current)
    ? projectionRef.current([arbitraryPoint.lon, arbitraryPoint.lat])
    : null;

  return (
    <div className="ocean-map-container">
      <div className="map-controls">
        <button>+</button>
        <button>−</button>
        <button className="reset">RESET</button>
        {heatmapGrid && (
          <button
            className={`heatmap-toggle ${heatmapVisible ? 'active' : ''}`}
            onClick={() => setHeatmapVisible(v => !v)}
            title={heatmapVisible ? 'Hide sea surface temperature overlay' : 'Show sea surface temperature overlay'}
          >
            SST
          </button>
        )}
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

           {/* Real SST heatmap — visual context only, never a prediction.
               pointer-events: none so it can never intercept a click; markers,
               the click-anywhere layer, and land-mass detection all sit
               logically and visually above it, untouched. */}
           {heatmapVisible && heatmapImageUrl && (
             <image
               href={heatmapImageUrl}
               x={-60} y={-60} width={800 + 120} height={500 + 120}
               style={{ pointerEvents: 'none' }}
             />
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

           {/* The current arbitrary (non-demo) point, if any — same
               "selected" visual language as a known marker. */}
           {arbitraryMarkerXY && (
             <g className="observation-node selected new-point" transform={`translate(${arbitraryMarkerXY[0]}, ${arbitraryMarkerXY[1]})`}>
               <circle r="45" fill="#e28c31" opacity="0.05" />
               <circle r="25" fill="#e28c31" opacity="0.1" />
               <circle r="4" fill="#e28c31" className="sonar-ping new-point-ping" />
               <circle r="1.5" fill="#fff" />
             </g>
           )}

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

           {/* Chooser — 2+ known markers within hit radius of the click.
               Each real marker's own lat/lon is shown exactly; nothing is
               nudged or approximated. */}
           {chooserOptions && (
             <g transform={`translate(${Math.min(chooserOptions.x + 15, 800 - 165)}, ${Math.min(chooserOptions.y + 15, 500 - (34 + chooserOptions.markers.length * 22))})`}>
               <rect width="160" height={30 + chooserOptions.markers.length * 22} fill="rgba(1, 7, 14, 0.96)" stroke="#7ce0d0" strokeWidth="0.7" rx="2" />
               <text x="10" y="16" fill="#78CBE9" fontSize="7" letterSpacing="0.05em">{chooserOptions.markers.length} LOCATIONS HERE</text>
               {chooserOptions.markers.map((m, i) => (
                 <g
                   key={m.id}
                   transform={`translate(6, ${26 + i * 22})`}
                   className="chooser-option"
                   onClick={(evt) => { evt.stopPropagation(); selectKnownMarker(m.id); }}
                 >
                   <rect width="148" height="18" fill="rgba(120, 203, 233, 0.08)" />
                   <text x="6" y="12" fill="#fff" fontSize="7.5">{m.region} · {m.lat.toFixed(2)}°, {m.lon.toFixed(2)}°</text>
                 </g>
               ))}
             </g>
           )}

           {/* No-coverage notice — clicked outside both regions' real
               model coverage. Clear, not silent, not an error dead-end. */}
           {coverageNotice && (
             <g transform={`translate(${Math.min(coverageNotice.x + 15, 800 - 175)}, ${Math.min(coverageNotice.y + 15, 500 - 36)})`} style={{ pointerEvents: 'none' }}>
               <rect width="170" height="36" fill="rgba(1, 7, 14, 0.94)" stroke="#e28c31" strokeWidth="0.6" rx="2" />
               <text x="10" y="16" fill="#e28c31" fontSize="7" fontWeight="bold" letterSpacing="0.05em">NO COVERAGE</text>
               <text x="10" y="28" fill="rgba(238, 250, 255, 0.8)" fontSize="7">No coverage at this location</text>
             </g>
           )}

        </svg>
      </div>

      {/* Legend + caption — only shown while the heatmap itself is visible
          and loaded; both are meaningless (and would just be clutter) with
          the layer hidden or absent. Not a model output — labeled as such. */}
      {heatmapGrid && heatmapVisible && (
        <div className="map-legend">
          <div className="legend-caption">
            SEA SURFACE TEMPERATURE — {heatmapGrid.date}, VIA SATELLITE (COPERNICUS MARINE)
          </div>
          <div className="legend-bar-row">
            <span className="legend-tick">{heatmapGrid.min.toFixed(1)}°C</span>
            <div className="legend-gradient" style={{ background: SST_LEGEND_GRADIENT_CSS }} />
            <span className="legend-tick">{heatmapGrid.max.toFixed(1)}°C</span>
          </div>
        </div>
      )}

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

        .new-point-ping {
          animation: pingOrange 2s infinite ease-out;
        }

        @keyframes ping {
          0% { stroke: #7ce0d0; stroke-width: 0; opacity: 1; }
          100% { stroke: #7ce0d0; stroke-width: 15; opacity: 0; }
        }

        @keyframes pingOrange {
          0% { stroke: #e28c31; stroke-width: 0; opacity: 1; }
          100% { stroke: #e28c31; stroke-width: 15; opacity: 0; }
        }

        .chooser-option {
          cursor: pointer;
        }

        .chooser-option:hover rect {
          fill: rgba(120, 203, 233, 0.22);
        }

        .heatmap-toggle {
          font-size: 0.55rem !important;
          letter-spacing: 0.08em;
          font-weight: 600;
        }

        .heatmap-toggle.active {
          background: rgba(120, 203, 233, 0.22);
          border-color: #7ce0d0;
          color: #fff;
        }

        .map-legend {
          position: absolute;
          bottom: 1.5rem;
          left: 1.5rem;
          z-index: 10;
          max-width: 260px;
          background: rgba(4, 21, 38, 0.85);
          backdrop-filter: blur(4px);
          border: 1px solid rgba(120, 203, 233, 0.2);
          border-radius: 2px;
          padding: 0.7rem 0.9rem;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .legend-caption {
          font-family: var(--font-public-sans), sans-serif;
          font-size: 0.55rem;
          letter-spacing: 0.05em;
          line-height: 1.4;
          color: rgba(238, 250, 255, 0.75);
        }

        .legend-bar-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .legend-tick {
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: 0.62rem;
          color: #eefaff;
          white-space: nowrap;
        }

        .legend-gradient {
          flex: 1;
          height: 8px;
          border-radius: 2px;
          min-width: 80px;
        }
      `}</style>
    </div>
  );
}
