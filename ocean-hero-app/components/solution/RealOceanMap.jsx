'use client';

import React, { useEffect, useState, useRef } from 'react';
import * as d3Geo from 'd3-geo';
import { MockOceanDataProvider } from '@/data/MockOceanDataProvider';
import { RealSSTDataProvider } from '@/data/RealSSTDataProvider';

// Mock color scales mimicking scientific depth models
const surfaceHeatStyle = {
  stop0: '#d13824', stop50: '#e28c31', stop100: '#15799e'
};
const deepHeatStyle = {
  stop0: '#15799e', stop50: '#083c61', stop100: '#031124'
};

export default function RealOceanMap({ depth, isSurface, selectedLocation, setSelectedLocation, selectedDateIndex }) {
  const [mapPath, setMapPath] = useState('');
  const [hoverLocation, setHoverLocation] = useState(null);
  const [sstImageDataUrl, setSstImageDataUrl] = useState(null);
  
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
    async function renderSSTGrid() {
      if (!isSurface || !projectionRef.current) return;

      await RealSSTDataProvider.load();

      const grid = await RealSSTDataProvider.getSSTGrid(selectedDateIndex);
      if (!grid) return;
      
      const ds = RealSSTDataProvider.data;
      if (!ds || !ds.latitude || !ds.longitude) return;

      const { latitude, longitude } = ds;

      const bleed = 400;
      const canvas = document.createElement('canvas');
      canvas.width = 800 + bleed * 2;
      canvas.height = 500 + bleed * 2;
      const ctx = canvas.getContext('2d');
      ctx.translate(bleed, bleed);

      for (let i = 0; i < latitude.length; i++) {
        for (let j = 0; j < longitude.length; j++) {
          const temp = grid[i][j];
          if (temp !== null) {
            const lat = latitude[i];
            const lon = longitude[j];

            const lonLeft = lon - 0.025;
            const lonRight = lon + 0.025;
            const latBottom = lat - 0.025;
            const latTop = lat + 0.025;

            const tl = projectionRef.current([lonLeft, latTop]);
            const br = projectionRef.current([lonRight, latBottom]);

            if (tl && br) {
              const getSSTColor = (temp) => {
                  if (temp < 20) return [0, 0, 128];
                  if (temp >= 32) return [255, 0, 0];
                  
                  const colors = [
                      [0, 0, 128],    // 20
                      [0, 0, 255],    // 22
                      [0, 255, 255],  // 24
                      [173, 255, 47], // 26
                      [255, 255, 0],  // 28
                      [255, 165, 0],  // 30
                      [255, 0, 0]     // 32
                  ];
                  
                  const idx = (temp - 20) / 2;
                  const i = Math.floor(idx);
                  const p = idx - i;
                  
                  if (i >= 6) return colors[6];
                  
                  const c1 = colors[i];
                  const c2 = colors[i + 1];
                  
                  const r = Math.round(c1[0] + (c2[0] - c1[0]) * p);
                  const g = Math.round(c1[1] + (c2[1] - c1[1]) * p);
                  const b = Math.round(c1[2] + (c2[2] - c1[2]) * p);
                  return [r, g, b];
              };
              
              const [r, g, b] = getSSTColor(temp);
              
              ctx.fillStyle = `rgb(${r},${g},${b})`;
              
              const x0 = Math.min(tl[0], br[0]);
              const y0 = Math.min(tl[1], br[1]);
              const w = Math.abs(br[0] - tl[0]);
              const h = Math.abs(br[1] - tl[1]);
              
              ctx.fillRect(x0, y0, w + 1.2, h + 1.2); // +1.2 prevents subpixel gaps
            }
          }
        }
      }
      setSstImageDataUrl(canvas.toDataURL());
    }
    
    renderSSTGrid();
  }, [mapPath, isSurface, selectedDateIndex]);

  const heatStyle = (isSurface && depth < 200) ? surfaceHeatStyle : deepHeatStyle;
  const opacity = Math.max(0.2, 1 - (depth / 1000));

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

    // Keep region classification tied to the same inverse-projected point.
    let regionName = 'Indian Ocean';
    if (lat > 5 && lon < 75) regionName = 'Arabian Sea';
    else if (lat > 5 && lon > 80) regionName = 'Bay of Bengal';

    return { lat, lon, x, y, regionName };
  };

  const handlePointer = (e) => {
    if (e.target.classList.contains('land-mass')) {
      setHoverLocation(null);
      return;
    }

    const coordinates = getMapCoordinates(e);
    if (!coordinates) {
      setHoverLocation(null);
      return;
    }
    
    setHoverLocation({
      ...coordinates,
      displayLat: parseFloat(coordinates.lat.toFixed(2)),
      displayLon: parseFloat(coordinates.lon.toFixed(2))
    });
  };

  const handlePointerLeave = () => {
    setHoverLocation(null);
  };

  const handleClick = (e) => {
    if (!e.target.classList.contains('land-mass')) {
      const coordinates = getMapCoordinates(e);
      if (!coordinates) return;

      setSelectedLocation({
        lat: coordinates.lat,
        lon: coordinates.lon,
        regionName: coordinates.regionName
      });
    }
  };

  // Re-calculate the projection coordinates for the currently locked selected point
  let selectedX = -100;
  let selectedY = -100;
  if (projectionRef.current && selectedLocation) {
     const cords = projectionRef.current([selectedLocation.lon, selectedLocation.lat]);
     if (cords) {
       selectedX = cords[0];
       selectedY = cords[1];
     }
  }

  return (
    <div className="ocean-map-container">
      <div className="map-controls">
        <button>+</button>
        <button>−</button>
        <button className="reset">RESET</button>
      </div>

      <div className="map-legend">
        <div className="legend-label">SEA SURFACE TEMPERATURE</div>
        <div className="legend-bar">
          <span className="lbl">20°C</span>
          <div className="gradient-track" />
          <span className="lbl">32°C</span>
        </div>
      </div>

      <div className="map-canvas">
        <svg 
           ref={svgRef}
           viewBox="0 0 800 500" 
           className={`d3-svg ${hoverLocation ? 'interactive-ocean' : ''}`} 
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

           {/* Raster heat layer overlay */}
           {isSurface && sstImageDataUrl && (
             <image 
                href={sstImageDataUrl} 
                x="-400"
                y="-400"
                width="1600" 
                height="1300" 
                style={{ pointerEvents: 'none', transition: 'all 0.5s ease' }} 
                opacity={opacity * 0.95} 
             />
           )}

           {/* Topographical Path for Continents */}
           {mapPath && (
             <path d={mapPath} className="land-mass" />
           )}
           
           {/* Locked Selected Coordinate Marker */}
           {selectedX > 0 && selectedY > 0 && (
             <g className="observation-node" transform={`translate(${selectedX}, ${selectedY})`}>
               <circle r="45" fill="#7ce0d0" opacity="0.05" />
               <circle r="25" fill="#7ce0d0" opacity="0.1" />
               <circle r="4" fill="#7ce0d0" className="sonar-ping" />
               <circle r="1.5" fill="#fff" />
               <line x1="0" y1="0" x2="-45" y2="-45" stroke="#7ce0d0" strokeWidth="0.5" opacity="0.8" />
             </g>
           )}

           {/* Dynamic Tooltip following pointer */}
           {hoverLocation && (
             <g transform={`translate(${hoverLocation.x + 15}, ${hoverLocation.y + 15})`} style={{ pointerEvents: 'none' }}>
               <rect width="120" height="90" fill="rgba(1, 7, 14, 0.9)" stroke="#3bb3cb" strokeWidth="0.5" rx="2" />
               <text x="10" y="18" fill="#78CBE9" fontSize="7" letterSpacing="0.05em">LOCATION</text>
               <text x="10" y="32" fill="#fff" fontSize="9" fontWeight="bold">{hoverLocation.displayLat >= 0 ? `${hoverLocation.displayLat}°N` : `${Math.abs(hoverLocation.displayLat)}°S`} • {hoverLocation.displayLon >= 0 ? `${hoverLocation.displayLon}°E` : `${Math.abs(hoverLocation.displayLon)}°W`}</text>
               <text x="10" y="44" fill="#7ce0d0" fontSize="7">{hoverLocation.regionName}</text>
               
               <text x="10" y="60" fill="#78CBE9" fontSize="7" letterSpacing="0.05em">SST</text>
               <text x="10" y="74" fill="#fff" fontSize="9" fontWeight="bold">{RealSSTDataProvider.getSST(hoverLocation.lat, hoverLocation.lon, selectedDateIndex)} {RealSSTDataProvider.getSST(hoverLocation.lat, hoverLocation.lon, selectedDateIndex) === null ? "" : "°C"}</text>
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

        .map-legend {
          position: absolute;
          bottom: 1.5rem;
          left: 1.5rem;
          z-index: 10;
          background: rgba(4, 21, 38, 0.7);
          backdrop-filter: blur(4px);
          border: 1px solid rgba(120, 203, 233, 0.15);
          padding: 0.8rem 1rem;
          border-radius: 2px;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .legend-label {
          font-size: 0.6rem;
          letter-spacing: 0.1em;
          color: #78CBE9;
          font-weight: 600;
        }

        .legend-bar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .lbl {
          font-size: 0.55rem;
          color: #eefaff;
          opacity: 0.6;
        }

        .gradient-track {
          width: 80px;
          height: 4px;
          border-radius: 2px;
          background: linear-gradient(90deg, rgb(0,0,128) 0%, rgb(0,0,255) 16%, rgb(0,255,255) 33%, rgb(173,255,47) 50%, rgb(255,255,0) 66%, rgb(255,165,0) 83%, rgb(255,0,0) 100%);
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
          cursor: crosshair;
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
