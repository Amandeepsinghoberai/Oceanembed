'use client';

import React, { useEffect, useState } from 'react';
import { REGION_SUMMARY } from '@/lib/modelStats';

// Model-confidence heatmap layer: a separate, additive overlay drawn from the
// real, pre-computed grids public/data/regional_confidence_grid.json (Bay of
// Bengal) and regional_confidence_grid_arabian.json (Arabian Sea); see
// backend/generate_confidence_grid.py. Every coloured cell is the real
// standard deviation across 7 independently trained ensemble models'
// predicted temperatures at that cell's real inputs - nothing is estimated or
// filled in.
//
// The two regions are DIFFERENT ensembles (Bay: 2-input SST+SSH; Arabian:
// 16-input SST/SSH/curl/MLD/SSS/vorticity/cluster) whose disagreements sit on
// different scales, so each region is coloured on its own range (its own
// 1st-99th percentile) and the legend gives both ranges. Colours are
// comparable within a region, not across regions.
//
// Every other ocean cell (the 77-80E gap, cells missing an input, anything
// outside both domains) is drawn as an explicit hatched "no ensemble data"
// area - never a colour, never a guess.
//
// Deliberately independent of the SST heatmap: it never reads or changes its
// data or rendering.

// Sequential palette, deliberately unlike the SST palette so the two layers
// can't be confused. Position 0 = models agree (high confidence),
// 1 = models disagree (low confidence).
const CONF_STOPS = [
  [0.00, 110, 231, 200],
  [0.30, 56, 189, 215],
  [0.55, 92, 130, 230],
  [0.78, 160, 90, 215],
  [1.00, 230, 60, 140],
];
const CONF_OPACITY = 0.9;

function confColor(t) {
  const x = Math.min(Math.max(t, 0), 1);
  let i = 0;
  while (i < CONF_STOPS.length - 2 && x > CONF_STOPS[i + 1][0]) i++;
  const a = CONF_STOPS[i];
  const b = CONF_STOPS[i + 1];
  const f = (x - a[0]) / (b[0] - a[0]);
  return [
    Math.round(a[1] + (b[1] - a[1]) * f),
    Math.round(a[2] + (b[2] - a[2]) * f),
    Math.round(a[3] + (b[3] - a[3]) * f),
  ];
}

const CONF_LEGEND_GRADIENT = `linear-gradient(90deg, ${CONF_STOPS
  .map((c) => `rgb(${c[1]},${c[2]},${c[3]}) ${(c[0] * 100).toFixed(1)}%`)
  .join(', ')})`;

// Load one confidence grid file and attach its own colour bounds: the
// 1st/99th percentile of its real values, on a log scale (the disagreement
// distribution is strongly right-skewed - most cells agree closely, a few
// disagree ~10x more - so a linear scale would paint nearly a whole basin one
// colour).
function loadGrid(url) {
  return fetch(url)
    .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
    .then((data) => {
      const real = [];
      for (const row of data.values) for (const v of row) if (v !== null && v !== undefined) real.push(v);
      if (real.length === 0) throw new Error('Confidence grid has no non-null values');
      real.sort((a, b) => a - b);
      const pct = (q) => real[Math.min(real.length - 1, Math.max(0, Math.round(q * (real.length - 1))))];
      return { ...data, count: real.length, colorMin: pct(0.01), colorMax: pct(0.99), min: real[0], max: real[real.length - 1] };
    });
}

export function useConfidenceLayer(projectionRef, mapReady) {
  const [grid, setGrid] = useState(null);        // Bay of Bengal grid (drives availability of the layer)
  const [arGrid, setArGrid] = useState(null);    // Arabian Sea grid, if it loaded
  const [arSettled, setArSettled] = useState(false); // Arabian fetch finished (ok or failed)
  const [sstMask, setSstMask] = useState(null);  // real ocean cells, from the SST grid file
  const [visible, setVisible] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadGrid('/data/regional_confidence_grid.json')
      .then((g) => { if (!cancelled) setGrid(g); })
      .catch((e) => console.error('Could not load the Bay of Bengal model-confidence grid - continuing without it:', e));

    loadGrid('/data/regional_confidence_grid_arabian.json')
      .then((g) => { if (!cancelled) setArGrid(g); })
      .catch((e) => console.error('Could not load the Arabian Sea model-confidence grid - that region will show as no data:', e))
      .finally(() => { if (!cancelled) setArSettled(true); });

    // The SST grid file is used ONLY for its land/sea mask, so the hatched
    // "no ensemble data" region covers real ocean and not land.
    fetch('/data/regional_sst_grid.json')
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => { if (!cancelled && d) setSstMask(d.values.map((row) => row.map((v) => v !== null && v !== undefined))); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!grid || !arSettled || !mapReady || !projectionRef.current) return;
    const projection = projectionRef.current;
    const { lat_min, lon_min, lat_max, lon_max, lat_step, lon_step, values } = grid;
    const rows = values.length;
    const cols = rows > 0 ? values[0].length : 0;
    if (!rows || !cols) return;

    // Both files share the SST grid's exact layout. If the Arabian file
    // somehow doesn't, ignore it rather than misplace its cells.
    const sameLayout = (g) => g && g.values.length === rows && g.values[0].length === cols
      && g.lat_min === lat_min && g.lon_min === lon_min && g.lat_step === lat_step && g.lon_step === lon_step;
    const regions = [grid, sameLayout(arGrid) ? arGrid : null].filter(Boolean).map((g) => {
      const logLo = Math.log(Math.max(g.colorMin, 1e-6));
      const logHi = Math.log(Math.max(g.colorMax, g.colorMin * 1.0001));
      return { values: g.values, logLo, logSpan: logHi - logLo || 1 };
    });

    const nw = projection([lon_min - lon_step / 2, lat_max + lat_step / 2]);
    const se = projection([lon_max + lon_step / 2, lat_min - lat_step / 2]);
    if (!nw || !se) return;
    const cellW = (se[0] - nw[0]) / cols;
    const cellH = (se[1] - nw[1]) / rows;
    if (!(cellW > 0) || !(cellH > 0)) return;

    const bleed = 60;
    const os = 2;
    const canvas = document.createElement('canvas');
    canvas.width = (800 + bleed * 2) * os;
    canvas.height = (500 + bleed * 2) * os;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(canvas.width, canvas.height);
    const px4 = image.data;

    // file row 0 = southernmost latitude; image row 0 = top (north).
    const fileRowOf = (r) => rows - 1 - r;
    // Real value of region k at (image-row r, col j), or null.
    const valueOf = (k, r, j) => {
      if (r < 0 || r >= rows || j < 0 || j >= cols) return null;
      const v = regions[k].values[fileRowOf(r)][j];
      return v === null || v === undefined ? null : v;
    };
    // Which region (if any) has a real value at this cell. The two domains
    // never overlap (Bay lon >= 80, Arabian lon < 77).
    const regionAt = (r, j) => {
      for (let k = 0; k < regions.length; k++) if (valueOf(k, r, j) !== null) return k;
      return -1;
    };

    const startX = Math.max(0, Math.floor((nw[0] + bleed) * os));
    const endX = Math.min(canvas.width, Math.ceil((se[0] + bleed) * os));
    const startY = Math.max(0, Math.floor((nw[1] + bleed) * os));
    const endY = Math.min(canvas.height, Math.ceil((se[1] + bleed) * os));

    for (let py = startY; py < endY; py++) {
      const y = (py + 0.5) / os - bleed;
      const rowF = (y - nw[1]) / cellH - 0.5;
      for (let px = startX; px < endX; px++) {
        const x = (px + 0.5) / os - bleed;
        const colF = (x - nw[0]) / cellW - 0.5;
        const ri = Math.round(rowF);
        const ci = Math.round(colF);
        if (ri < 0 || ri >= rows || ci < 0 || ci >= cols) continue;
        const k = (py * canvas.width + px) * 4;

        const region = regionAt(ri, ci);
        if (region >= 0) {
          // Blend only REAL neighbouring readings from the SAME region's
          // ensemble (bilinear), so colour is smooth between cells without
          // ever averaging toward a null or across the two ensembles' scales.
          const nearest = valueOf(region, ri, ci);
          const j0 = Math.floor(colF), r0 = Math.floor(rowF);
          const tx = colF - j0, ty = rowF - r0;
          let sum = 0, wsum = 0;
          const corners = [[r0, j0, (1 - tx) * (1 - ty)], [r0, j0 + 1, tx * (1 - ty)], [r0 + 1, j0, (1 - tx) * ty], [r0 + 1, j0 + 1, tx * ty]];
          for (const [r, j, w] of corners) {
            const v = valueOf(region, r, j);
            if (v !== null && w > 0) { sum += v * w; wsum += w; }
          }
          const value = wsum > 0 ? sum / wsum : nearest;
          const t = (Math.log(Math.max(value, 1e-6)) - regions[region].logLo) / regions[region].logSpan;
          const [r, g, b] = confColor(t);
          px4[k] = r; px4[k + 1] = g; px4[k + 2] = b; px4[k + 3] = Math.round(CONF_OPACITY * 255);
        } else if (sstMask && sstMask[fileRowOf(ri)] && sstMask[fileRowOf(ri)][ci]) {
          // Real ocean with no ensemble value (outside both domains, or
          // missing an input): hatched "no data" - explicitly not a value.
          const stripe = (((px + py) / os) % 9) < 3.2;
          if (stripe) { px4[k] = 150; px4[k + 1] = 162; px4[k + 2] = 178; px4[k + 3] = 215; }
          else { px4[k] = 14; px4[k + 1] = 30; px4[k + 2] = 50; px4[k + 3] = 200; }
        }
      }
    }
    ctx.putImageData(image, 0, 0);

    let cancelled = false;
    let objectUrl = null;
    canvas.toBlob((blob) => {
      if (cancelled || !blob) return;
      objectUrl = URL.createObjectURL(blob);
      setImageUrl(objectUrl);
    });
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [grid, arGrid, arSettled, sstMask, mapReady, projectionRef]);

  return {
    ready: !!grid && !!imageUrl,
    visible, setVisible, imageUrl, grid, arGrid,
  };
}

const fmt = (v) => (v >= 0.1 ? v.toFixed(2) : v.toFixed(3));

function RangeRow({ label, g }) {
  const mid = Math.sqrt(g.colorMin * g.colorMax); // log-scale midpoint
  return (
    <div className="conf-range">
      <span className="conf-range-label">{label}</span>
      <span>≤{fmt(g.colorMin)}</span><span>{fmt(mid)}</span><span>≥{fmt(g.colorMax)}°C</span>
    </div>
  );
}

export function ConfidenceLegend({ layer, raised }) {
  const g = layer.grid;
  const a = layer.arGrid;
  if (!g) return null;
  return (
    <div className={`conf-legend ${raised ? 'raised' : ''}`}>
      <div className="conf-caption">
        MODEL CONFIDENCE — DISAGREEMENT BETWEEN {g.n_models} ENSEMBLE MODELS IN EACH REGION, {g.date} (LOG SCALE)
      </div>
      <div className="conf-ends"><span>HIGH CONFIDENCE (agree)</span><span>LOW CONFIDENCE (disagree)</span></div>
      <div className="conf-bar" style={{ background: CONF_LEGEND_GRADIENT }} />
      <RangeRow label="BAY OF BENGAL" g={g} />
      {a && <RangeRow label="ARABIAN SEA" g={a} />}
      <div className="conf-scalenote">
        Each region is a separate ensemble with its own colour range; colours are comparable within a region, not between regions.
      </div>
      <div className="conf-nodata"><i className="conf-hatch" /> No ensemble data: the 77–80°E gap, cells missing an input, and anywhere outside both models&apos; domains</div>
      <div className="conf-note">
        <strong>Agreement, not accuracy.</strong> This shows how closely the {g.n_models} models in each region agree with each other,
        not how close they are to reality. Their real error against Argo floats is{' '}
        {REGION_SUMMARY['BAY OF BENGAL'].rmse.toFixed(3)}°C RMSE (Bay of Bengal) and{' '}
        {REGION_SUMMARY['ARABIAN SEA'].rmse.toFixed(3)}°C (Arabian Sea), far larger than typical spreads. Models can agree and still be wrong.
      </div>

      <style>{`
        .conf-legend { position: absolute; bottom: 1.5rem; left: 1.5rem; z-index: 10; max-width: 310px; background: rgba(4, 21, 38, 0.9); backdrop-filter: blur(4px); border: 1px solid rgba(120, 203, 233, 0.2); border-radius: 2px; padding: 0.65rem 0.85rem; display: flex; flex-direction: column; gap: 0.35rem; }
        .conf-legend.raised { bottom: 7rem; }
        .conf-caption { font-family: var(--font-public-sans), sans-serif; font-size: 0.52rem; letter-spacing: 0.05em; line-height: 1.4; color: rgba(238, 250, 255, 0.85); }
        .conf-ends { display: flex; justify-content: space-between; gap: 0.5rem; font-family: var(--font-space-grotesk), sans-serif; font-size: 0.5rem; color: #eefaff; }
        .conf-bar { height: 8px; border-radius: 2px; }
        .conf-range { display: grid; grid-template-columns: 5.6rem 1fr 1fr 1fr; gap: 0.3rem; font-family: var(--font-space-grotesk), sans-serif; font-size: 0.55rem; color: #eefaff; }
        .conf-range span:nth-child(3) { text-align: center; }
        .conf-range span:nth-child(4) { text-align: right; }
        .conf-range-label { font-size: 0.48rem; letter-spacing: 0.05em; color: #78CBE9; }
        .conf-scalenote { font-size: 0.5rem; line-height: 1.4; font-style: italic; color: rgba(238, 250, 255, 0.6); }
        .conf-nodata { display: flex; align-items: center; gap: 0.4rem; font-size: 0.5rem; line-height: 1.35; color: rgba(238, 250, 255, 0.75); }
        .conf-hatch { flex: 0 0 auto; width: 14px; height: 10px; border: 1px solid rgba(150, 162, 178, 0.6); background: repeating-linear-gradient(135deg, rgba(150, 162, 178, 0.85) 0 2px, rgba(14, 30, 50, 0.9) 2px 5px); }
        .conf-note { padding-top: 0.35rem; border-top: 1px solid rgba(120, 203, 233, 0.15); font-size: 0.52rem; line-height: 1.45; color: rgba(238, 250, 255, 0.72); }
        .conf-note strong { color: #f3c98b; font-weight: 600; }
      `}</style>
    </div>
  );
}
