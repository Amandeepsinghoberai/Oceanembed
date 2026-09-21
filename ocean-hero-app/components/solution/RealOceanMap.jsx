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

// Smaller than MARKER_HIT_RADIUS on purpose — Argo dots are hover-only
// context (never click targets), and a known marker always wins when both
// are nearby, so a tight radius just avoids a dot eating a hover that was
// clearly meant for open water or the land mass.
const ARGO_HIT_RADIUS = 9;

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

// Standard cool->warm spectral temperature scale (deep blue -> cyan -> green
// -> yellow -> orange -> red), the palette convention used by published
// satellite SST imagery. This is visual context only, never a model
// prediction — see regional_sst_grid.json's own "raw satellite reading"
// framing. The legend below is generated from these same stops, so the
// colours on the map always mean what the legend says.
// Each stop is [position, r, g, b]. The positions are deliberately uneven:
// this region's water is warm almost everywhere (1st-99th percentile spans
// only ~24-35°C), so spreading the palette evenly would render tropical sea
// in the cool half of the scale and read as cold. Weighting the warm colours
// toward the middle puts typical open ocean in yellow/amber, leaving blue and
// cyan for genuinely cooler upwelling water and red for the hottest gulfs.
const SST_COLOR_STOPS = [
  [0.00, 45, 85, 175],
  [0.12, 35, 160, 215],
  [0.24, 50, 200, 180],
  [0.34, 140, 220, 100],
  [0.44, 235, 220, 65],
  [0.56, 250, 180, 40],
  [0.72, 245, 120, 30],
  [1.00, 185, 35, 22],
];

// Opacity of the finished overlay. High enough to read as a real satellite
// image rather than a washed-out tint, while still letting the basemap's
// graticule show through faintly.
const HEATMAP_OPACITY = 0.92;

function interpolateSstColor(t) {
  const x = Math.min(Math.max(t, 0), 1);
  let i = 0;
  while (i < SST_COLOR_STOPS.length - 2 && x > SST_COLOR_STOPS[i + 1][0]) i++;
  const c1 = SST_COLOR_STOPS[i];
  const c2 = SST_COLOR_STOPS[i + 1];
  const frac = (x - c1[0]) / (c2[0] - c1[0]);
  return [
    Math.round(c1[1] + (c2[1] - c1[1]) * frac),
    Math.round(c1[2] + (c2[2] - c1[2]) * frac),
    Math.round(c1[3] + (c2[3] - c1[3]) * frac),
  ];
}

// Same stops, same positions — so the legend bar is always a faithful key to
// what's drawn on the map.
const SST_LEGEND_GRADIENT_CSS = `linear-gradient(90deg, ${SST_COLOR_STOPS
  .map(c => `rgb(${c[1]},${c[2]},${c[3]}) ${(c[0] * 100).toFixed(1)}%`)
  .join(', ')})`;

// Catmull-Rom cubic through four samples — a smooth curve that passes exactly
// through each real reading, rather than a hard step between them.
function catmullRom(p0, p1, p2, p3, t) {
  const a = -0.5 * p0 + 1.5 * p1 - 1.5 * p2 + 0.5 * p3;
  const b = p0 - 2.5 * p1 + 2 * p2 - 0.5 * p3;
  const c = -0.5 * p0 + 0.5 * p2;
  return ((a * t + b) * t + c) * t + p1;
}

// Sampler over the real SST grid (flattened north-down). `mask` is 1 where the
// file held an actual reading and 0 where it was null (land or missing), which
// lets colour be interpolated from real readings ONLY — no averaging toward
// the empty cells, so coastlines don't smear or darken.
function createGridSampler(grid, mask, cols, rows) {
  const idx = (j, r) => {
    const jj = j < 0 ? 0 : j > cols - 1 ? cols - 1 : j;
    const rr = r < 0 ? 0 : r > rows - 1 ? rows - 1 : r;
    return rr * cols + jj;
  };

  // A Gaussian-blurred copy of the land/sea mask. Interpolating the raw 0/1
  // mask and thresholding it reproduces the grid's own 0.25° staircase along
  // every coast (each step is several screen pixels wide); blurring first and
  // thresholding after rounds those steps into smooth curves. Cost of doing
  // it: isolated single-cell islands fall below the threshold and get covered
  // by the overlay — anything two cells or larger survives.
  const SIGMA = 0.75;
  const kernel = [];
  for (let d = -2; d <= 2; d++) kernel.push(Math.exp(-(d * d) / (2 * SIGMA * SIGMA)));
  const kernelSum = kernel.reduce((a, b) => a + b, 0);

  const horizontal = new Float32Array(rows * cols);
  const smooth = new Float32Array(rows * cols);
  for (let r = 0; r < rows; r++) {
    for (let j = 0; j < cols; j++) {
      let acc = 0;
      for (let d = -2; d <= 2; d++) acc += mask[idx(j + d, r)] * kernel[d + 2];
      horizontal[r * cols + j] = acc / kernelSum;
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let j = 0; j < cols; j++) {
      let acc = 0;
      for (let d = -2; d <= 2; d++) acc += horizontal[idx(j, r + d)] * kernel[d + 2];
      smooth[r * cols + j] = acc / kernelSum;
    }
  }

  // Smoothly-interpolated fraction of real data around a point. The caller
  // thresholds this into the overlay's edge, which is what keeps coastlines
  // crisp curves instead of either a 0.25° staircase or a blurry halo.
  const coverage = (colF, rowF) => {
    const j0 = Math.floor(colF);
    const r0 = Math.floor(rowF);
    const tx = colF - j0;
    const ty = rowF - r0;
    const c = [];
    for (let m = -1; m <= 2; m++) {
      c.push(catmullRom(
        smooth[idx(j0 - 1, r0 + m)], smooth[idx(j0, r0 + m)],
        smooth[idx(j0 + 1, r0 + m)], smooth[idx(j0 + 2, r0 + m)], tx,
      ));
    }
    return catmullRom(c[0], c[1], c[2], c[3], ty);
  };

  const value = (colF, rowF) => {
    const j0 = Math.floor(colF);
    const r0 = Math.floor(rowF);
    const tx = colF - j0;
    const ty = rowF - r0;

    let allReal = true;
    for (let m = -1; m <= 2 && allReal; m++) {
      for (let n = -1; n <= 2; n++) {
        if (!mask[idx(j0 + n, r0 + m)]) { allReal = false; break; }
      }
    }

    if (allReal) {
      const c = [];
      for (let m = -1; m <= 2; m++) {
        c.push(catmullRom(
          grid[idx(j0 - 1, r0 + m)], grid[idx(j0, r0 + m)],
          grid[idx(j0 + 1, r0 + m)], grid[idx(j0 + 2, r0 + m)], tx,
        ));
      }
      return catmullRom(c[0], c[1], c[2], c[3], ty);
    }

    // Within a cell of a coast or a data gap — blend only the real readings.
    const ks = [idx(j0, r0), idx(j0 + 1, r0), idx(j0, r0 + 1), idx(j0 + 1, r0 + 1)];
    const ws = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty];
    let sum = 0;
    let weight = 0;
    for (let q = 0; q < 4; q++) {
      if (mask[ks[q]]) { sum += grid[ks[q]] * ws[q]; weight += ws[q]; }
    }
    if (weight > 0) return sum / weight;

    // Smoothing the coastline can carry the overlay's edge a fraction of a
    // cell past the last real reading; take the nearest ones so the edge is
    // coloured rather than punched through with holes.
    for (let ring = 1; ring <= 2; ring++) {
      let ringSum = 0;
      let ringCount = 0;
      for (let m = -ring; m <= ring; m++) {
        for (let n = -ring; n <= ring; n++) {
          const k = idx(j0 + n, r0 + m);
          if (mask[k]) { ringSum += grid[k]; ringCount++; }
        }
      }
      if (ringCount > 0) return ringSum / ringCount;
    }
    return null;
  };

  return { coverage, value };
}

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

  // Real Argo float positions from the last 30 days — same "static snapshot,
  // loaded once" pattern as the heatmap grid, generated by
  // backend/generate_argo_points.py. null until the fetch settles (whether
  // it finds floats or not); a failure here must never block the rest of the
  // map, same as the heatmap. Off by default — it's supplementary context,
  // not something every viewer needs cluttering the map immediately.
  const [argoPoints, setArgoPoints] = useState(null);
  const [argoPointsVisible, setArgoPointsVisible] = useState(false);
  const [hoverArgoPoint, setHoverArgoPoint] = useState(null);
  const [zoom, setZoom] = useState(1);

  const svgRef = useRef(null);
  const projectionRef = useRef(null);

  useEffect(() => {
    fetch('/data/indianOcean.geojson')
      .then(res => res.json())
      .then(topology => {
        // Tight projection over India, Bay of Bengal, Arabian Sea, and Indian Ocean.
        // scale/translate are chosen so the real trained-model coverage region
        // (5-30°N, 45-100°E) fills as much of the 800x500 viewBox as possible
        // without clipping — verified directly: at this scale, all 5 real
        // markers and all 8 coverage-region corners still fall inside the
        // viewBox with margin (this is the max scale before any of them clip).
        const projection = d3Geo.geoEquirectangular()
          .center([77.5, -2.5])
          .scale(810)
          .translate([470.69, 532.74]);

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
        const real = [];
        for (const row of data.values) {
          for (const v of row) {
            if (v === null || v === undefined) continue;
            real.push(v);
          }
        }
        if (real.length === 0) throw new Error('Grid has no non-null values');
        real.sort((a, b) => a - b);

        // Colour-scale bounds come from the 1st/99th percentile of the real
        // readings, not the outright min/max. The grid covers a land-inclusive
        // box, so a handful of inland-water cells (a few high-altitude lakes
        // near 28°N) sit ~12°C below anything in the sea and, used as the
        // scale floor, flatten the entire ocean into one band of the palette.
        // Values beyond these bounds still render — clamped to the end colour,
        // which the legend labels as "≤"/"≥" so the scale is never misread.
        const percentile = (q) => real[Math.min(real.length - 1, Math.max(0, Math.round(q * (real.length - 1))))];
        setHeatmapGrid({
          ...data,
          min: real[0],
          max: real[real.length - 1],
          colorMin: percentile(0.01),
          colorMax: percentile(0.99),
        });
      })
      .catch(e => console.error('Could not load regional SST heatmap — continuing without it:', e));
    return () => { cancelled = true; };
  }, []);

  // Load the real, static Argo float snapshot once — same pattern as the SST
  // grid above (a periodically-refreshed file, not a live fetch). An empty
  // points array is a genuine, valid outcome (no real float reported in the
  // window) and is kept, not treated as a failure; only an actual fetch/parse
  // error falls through to the catch, and even then the rest of the map keeps
  // working exactly as without this layer.
  useEffect(() => {
    let cancelled = false;
    fetch('/data/recent_argo_points.json')
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (cancelled) return;
        setArgoPoints(Array.isArray(data.points) ? data.points : []);
      })
      .catch(e => console.error('Could not load recent Argo float positions — continuing without it:', e));
    return () => { cancelled = true; };
  }, []);

  // Rasterize the grid to an offscreen canvas once both the grid and the
  // projection are ready, then use the result as a single <image> overlay —
  // far cheaper than one SVG element per cell for a 100x220 grid, and (via
  // pointer-events: none on the <image> itself, set below) never intercepts
  // a click, so markers/click-anywhere/land-mass detection are untouched.
  //
  // Every output pixel is resampled directly from the real grid with a smooth
  // (Catmull-Rom) interpolation between neighbouring readings, at twice the
  // viewBox resolution so it stays sharp on high-DPI screens. Nothing is
  // invented: the interpolation only ever passes through real values, and
  // cells the file marked null stay out of the blend entirely. Doing the
  // resample here — rather than drawing blocks and letting the browser
  // upscale them — is what removes both the blocky edges and the soft,
  // washed-out look of a double-resampled bitmap.
  useEffect(() => {
    if (!heatmapGrid || !mapPath || !projectionRef.current) return;

    const { lat_min, lon_min, lat_max, lon_max, lat_step, lon_step, values, colorMin, colorMax } = heatmapGrid;
    const rows = values.length;
    const cols = rows > 0 ? values[0].length : 0;
    if (rows === 0 || cols === 0) return;

    const range = colorMax - colorMin || 1;
    const halfLat = lat_step / 2;
    const halfLon = lon_step / 2;

    // Flatten to north-down order (row 0 of the file is the southernmost
    // latitude, but row 0 of an image is its top edge).
    const grid = new Float32Array(rows * cols);
    const mask = new Uint8Array(rows * cols);
    for (let i = 0; i < rows; i++) {
      const row = values[i];
      const target = (rows - 1 - i) * cols;
      for (let j = 0; j < cols; j++) {
        const v = row[j];
        if (v === null || v === undefined) continue; // land/missing — stays masked out
        grid[target + j] = v;
        mask[target + j] = 1;
      }
    }
    const sampler = createGridSampler(grid, mask, cols, rows);

    // The map's projection is equirectangular, so the grid's real-world extent
    // maps to one axis-aligned rectangle — projecting its two outer corners is
    // enough to place every cell.
    const nw = projectionRef.current([lon_min - halfLon, lat_max + halfLat]);
    const se = projectionRef.current([lon_max + halfLon, lat_min - halfLat]);
    if (!nw || !se) return;
    const cellW = (se[0] - nw[0]) / cols;
    const cellH = (se[1] - nw[1]) / rows;
    if (!(cellW > 0) || !(cellH > 0)) return;

    const bleed = 60;
    const oversample = 2;
    const canvas = document.createElement('canvas');
    canvas.width = (800 + bleed * 2) * oversample;
    canvas.height = (500 + bleed * 2) * oversample;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(canvas.width, canvas.height);
    const data = image.data;

    // Only the grid's own footprint needs visiting; everything else stays
    // transparent.
    const startX = Math.max(0, Math.floor((nw[0] + bleed) * oversample));
    const endX = Math.min(canvas.width, Math.ceil((se[0] + bleed) * oversample));
    const startY = Math.max(0, Math.floor((nw[1] + bleed) * oversample));
    const endY = Math.min(canvas.height, Math.ceil((se[1] + bleed) * oversample));

    for (let py = startY; py < endY; py++) {
      const rowF = ((py + 0.5) / oversample - bleed - nw[1]) / cellH - 0.5;
      const rowOffset = py * canvas.width;
      for (let px = startX; px < endX; px++) {
        const colF = ((px + 0.5) / oversample - bleed - nw[0]) / cellW - 0.5;

        // Threshold the smoothed coverage into a crisp, anti-aliased edge.
        const edge = (sampler.coverage(colF, rowF) - 0.44) / 0.12;
        if (edge <= 0) continue;

        const value = sampler.value(colF, rowF);
        if (value === null) continue;

        const [r, g, b] = interpolateSstColor((value - colorMin) / range);
        const k = (rowOffset + px) * 4;
        data[k] = r;
        data[k + 1] = g;
        data[k + 2] = b;
        data[k + 3] = Math.round(Math.min(1, edge) * HEATMAP_OPACITY * 255);
      }
    }
    ctx.putImageData(image, 0, 0);

    let cancelled = false;
    let objectUrl = null;
    canvas.toBlob((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setHeatmapImageUrl(objectUrl);
    });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
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
    const viewBoxWidth = 800 / zoom;
    const viewBoxHeight = 500 / zoom;
    const viewBoxX = (800 - viewBoxWidth) / 2;
    const viewBoxY = (500 - viewBoxHeight) / 2;
    const scale = Math.min(rect.width / viewBoxWidth, rect.height / viewBoxHeight);
    const renderedWidth = viewBoxWidth * scale;
    const renderedHeight = viewBoxHeight * scale;
    const offsetX = (rect.width - renderedWidth) / 2;
    const offsetY = (rect.height - renderedHeight) / 2;
    const x = (e.clientX - rect.left - offsetX) / scale + viewBoxX;
    const y = (e.clientY - rect.top - offsetY) / scale + viewBoxY;

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

  // Real Argo float positions, projected the same way as the 5 known
  // markers. Rendered with pointer-events: none (same as the heatmap image)
  // so they can never intercept a click — hover is hand-detected here from
  // the same pointer coordinates already computed for known-marker hover.
  const argoMarkers = (argoPoints && projectionRef.current)
    ? argoPoints.map(p => {
        const proj = projectionRef.current([p.lon, p.lat]);
        return proj ? { ...p, x: proj[0], y: proj[1] } : null;
      }).filter(Boolean)
    : [];

  const findNearestArgoPoint = (x, y) => {
    let nearest = null;
    let nearestDist = ARGO_HIT_RADIUS;
    argoMarkers.forEach(p => {
      const dist = Math.hypot(p.x - x, p.y - y);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = p;
      }
    });
    return nearest;
  };

  const handlePointer = (e) => {
    if (e.target.classList.contains('land-mass')) {
      setHoverMarker(null);
      setHoverArgoPoint(null);
      return;
    }

    const coordinates = getMapCoordinates(e);
    if (!coordinates) {
      setHoverMarker(null);
      setHoverArgoPoint(null);
      return;
    }

    // A known marker always takes priority over an Argo dot when both are
    // within reach of the pointer.
    const nearestKnown = findNearestMarker(coordinates.x, coordinates.y);
    setHoverMarker(nearestKnown);
    setHoverArgoPoint(
      !nearestKnown && argoPointsVisible ? findNearestArgoPoint(coordinates.x, coordinates.y) : null
    );
  };

  const handlePointerLeave = () => {
    setHoverMarker(null);
    setHoverArgoPoint(null);
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
        <button type="button" onClick={() => setZoom(value => Math.min(4, value * 1.5))} aria-label="Zoom in">+</button>
        <button type="button" onClick={() => setZoom(value => Math.max(1, value / 1.5))} aria-label="Zoom out">−</button>
        <button type="button" className="reset" onClick={() => setZoom(1)}>RESET</button>
        {heatmapGrid && (
          <button
            className={`heatmap-toggle ${heatmapVisible ? 'active' : ''}`}
            onClick={() => setHeatmapVisible(v => !v)}
            title={heatmapVisible ? 'Hide sea surface temperature overlay' : 'Show sea surface temperature overlay'}
          >
            SST
          </button>
        )}
        {argoPoints && (
          <button
            className={`heatmap-toggle ${argoPointsVisible ? 'active' : ''}`}
            onClick={() => setArgoPointsVisible(v => !v)}
            title={argoPointsVisible ? 'Hide real Argo float positions' : 'Show real Argo float positions (last 30 days)'}
          >
            ARGO
          </button>
        )}
      </div>

      <div className="map-canvas">
        <svg
           ref={svgRef}
           viewBox={`${(800 - 800 / zoom) / 2} ${(500 - 500 / zoom) / 2} ${800 / zoom} ${500 / zoom}`}
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

           {/* Real Argo float positions, last 30 days — honest visual context
               only, never a prediction target. pointer-events: none so they
               can never intercept a click (hover is hand-detected above);
               visually beneath the 5 known markers so those stay the clear
               primary interaction. */}
           {argoPointsVisible && argoMarkers.map(p => (
             <circle
               key={p.float_id}
               cx={p.x} cy={p.y}
               r={hoverArgoPoint?.float_id === p.float_id ? 3.5 : 2.2}
               fill="none"
               stroke="rgba(238, 250, 255, 0.65)"
               strokeWidth={hoverArgoPoint?.float_id === p.float_id ? 1.1 : 0.7}
               style={{ pointerEvents: 'none' }}
             />
           ))}

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

           {/* Tooltip for a hovered real Argo float dot — position and real
               report date only, no temperature (this snapshot doesn't carry
               one); never implies a prediction or a validation of anything. */}
           {hoverArgoPoint && (
             <g transform={`translate(${hoverArgoPoint.x + 12}, ${hoverArgoPoint.y + 12})`} style={{ pointerEvents: 'none' }}>
               <rect width="128" height="46" fill="rgba(1, 7, 14, 0.9)" stroke="rgba(238, 250, 255, 0.4)" strokeWidth="0.5" rx="2" />
               <text x="9" y="16" fill="rgba(238, 250, 255, 0.7)" fontSize="6.5" letterSpacing="0.05em">REAL ARGO FLOAT</text>
               <text x="9" y="29" fill="#fff" fontSize="8" fontWeight="bold">{hoverArgoPoint.date}</text>
               <text x="9" y="40" fill="rgba(238, 250, 255, 0.55)" fontSize="6.5">{hoverArgoPoint.region}</text>
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
            <span className="legend-tick">≤{heatmapGrid.colorMin.toFixed(1)}°C</span>
            <div className="legend-gradient" style={{ background: SST_LEGEND_GRADIENT_CSS }} />
            <span className="legend-tick">≥{heatmapGrid.colorMax.toFixed(1)}°C</span>
          </div>
        </div>
      )}

      <style>{`
        .ocean-map-container {
          position: relative;
          width: 100%;
          /* Match the SVG's own 800x500 (8:5) viewBox shape exactly, instead
             of stretching to fill the tall AnalysisPanel sibling's height —
             that mismatch (container forced near-square, viewBox landscape)
             is what was causing the large black letterboxed bars above and
             below the map. */
          aspect-ratio: 8 / 5;
          height: auto;
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
          fill: #0a2740;
          /* Stroked in the fill colour on purpose, so land renders as one
             continuous silhouette with no internal political boundaries.
             The bundled Natural Earth basemap draws Kashmir split along the
             Line of Control and Aksai Chin as Chinese territory, which is not
             a boundary this map should be asserting; it ships no India-POV
             alternative, so rather than depict it wrongly the map depicts no
             political boundaries at all. (The stroke also closes the hairline
             seams between adjacent country polygons.) Coastlines stay legible
             because the ocean side of them carries the SST overlay. */
          stroke: #0a2740;
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
          width: auto;
          height: 28px;
          padding: 0 0.5rem;
          white-space: nowrap;
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
