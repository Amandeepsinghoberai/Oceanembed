'use client';

import React, { useEffect, useMemo, useState } from 'react';

// "Recent seasons (NRT)": a self-contained Solution-page section that scrubs
// through ~26 months of REAL near-real-time inputs run through the trained
// models, from the pre-computed public/data/recent_seasonal_profiles.json
// (see backend/generate_recent_seasons.py). Nothing is fetched or computed at
// request time, and nothing here is filled in: a month with no real input is
// shown as unavailable.
//
// Honesty framing (always visible): these are NRT-based model predictions, not
// the quality-controlled data behind the official validation numbers, and not
// checked against Argo. Months whose real inputs fall outside (or at the edge
// of) the range the model was trained on are flagged on the slider, in the
// month's readout and on the time series - never only in a log.

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
// Hand-rolled - this project has hit a server/browser locale hydration
// mismatch before, so no toLocale* here.
const parts = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null; };
const monthLabel = (iso) => { const p = parts(iso); return p ? `${MONTH_ABBR[p.m]} ${p.y}` : iso; };
const monthLabelFull = (iso) => { const p = parts(iso); return p ? `${MONTH_FULL[p.m]} ${p.y}` : iso; };
const shortLabel = (iso) => { const p = parts(iso); return p ? `${MONTH_ABBR[p.m]} ${String(p.y).slice(2)}` : iso; };

const VAR_LABEL = { sst: 'SST', ssh: 'SSH', curl: 'Wind-stress curl', mld: 'Mixed-layer depth', sss: 'Salinity', vorticity: 'Eddy vorticity' };
const VAR_UNIT = { sst: '°C', ssh: 'm', curl: 'N/m³', mld: 'm', sss: 'PSU', vorticity: '1/s' };
function fmtVar(name, v) {
  if (name === 'curl' || name === 'vorticity') return v.toExponential(2);
  if (name === 'ssh') return v.toFixed(3);
  if (name === 'mld') return v.toFixed(1);
  return v.toFixed(2);
}

// Profile chart geometry (uniform-scaled SVG).
const CH = { w: 300, h: 250, left: 40, right: 12, top: 12, bottom: 28, tMin: 5, tMax: 32, dMax: 1000 };
const cx = (t) => CH.left + ((Math.min(Math.max(t, CH.tMin), CH.tMax) - CH.tMin) / (CH.tMax - CH.tMin)) * (CH.w - CH.left - CH.right);
const cy = (d) => CH.top + (d / CH.dMax) * (CH.h - CH.top - CH.bottom);
const profilePoints = (depths, temps) => depths.map((d, i) => `${cx(temps[i]).toFixed(1)},${cy(d).toFixed(1)}`).join(' ');

// Time-series geometry.
const TS = { w: 300, h: 130, left: 34, right: 10, top: 10, bottom: 22 };

const PLAY_MS = 850;

export default function RecentSeasons() {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [pointIdx, setPointIdx] = useState(0);
  const [monthIdx, setMonthIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [tsDepthIdx, setTsDepthIdx] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch('/data/recent_seasonal_profiles.json')
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => { if (!cancelled) { setData(d); setMonthIdx(d.window.n_months - 1); } })
      .catch((e) => { if (!cancelled) setError(String(e.message || e)); });
    return () => { cancelled = true; };
  }, []);

  const point = data ? data.points[pointIdx] : null;
  const months = point ? point.months : [];
  const nMonths = months.length;
  const month = months[monthIdx] || null;
  const depths = data ? data.depths_m : [];
  const ranges = point && data ? data.training_ranges[point.location.region] : null;

  useEffect(() => {
    if (!playing || !nMonths) return undefined;
    const id = setInterval(() => setMonthIdx((i) => (i + 1) % nMonths), PLAY_MS);
    return () => clearInterval(id);
  }, [playing, nMonths]);

  const status = (m) => {
    if (!m || !m.predicted_temp_c) return 'unavailable';
    if (m.flags && m.flags.some((f) => f.level === 'outside')) return 'outside';
    if (m.flags && m.flags.length) return 'edge';
    return 'ok';
  };
  const counts = useMemo(() => {
    const c = { ok: 0, edge: 0, outside: 0, unavailable: 0 };
    months.forEach((m) => { c[status(m)] += 1; });
    return c;
  }, [months]);

  // Same calendar month in the other years, for the "seasons repeat" overlay.
  const sameMonthOthers = useMemo(() => {
    if (!month) return [];
    const p = parts(month.date);
    return months.filter((m, i) => i !== monthIdx && m.predicted_temp_c && parts(m.date).m === p.m);
  }, [months, monthIdx, month]);

  if (error) {
    return <section className="rs-root"><div className="rs-inner"><div className="rs-head"><div className="rs-kicker">RECENT SEASONS · NRT</div><p className="rs-sub">The recent-seasons data could not be loaded ({error}).</p></div></div></section>;
  }
  if (!data || !point) return null;

  const st = status(month);
  const tsDepth = depths[tsDepthIdx];
  const series = months.map((m) => (m.predicted_temp_c ? m.predicted_temp_c[tsDepthIdx] : null));
  const finite = series.filter((v) => v !== null);
  const tsMin = Math.floor(Math.min(...finite) - 0.5);
  const tsMax = Math.ceil(Math.max(...finite) + 0.5);
  const tsX = (i) => TS.left + (i / Math.max(1, nMonths - 1)) * (TS.w - TS.left - TS.right);
  const tsY = (v) => TS.top + (1 - (v - tsMin) / (tsMax - tsMin || 1)) * (TS.h - TS.top - TS.bottom);
  const tsSegments = [];
  let run = [];
  series.forEach((v, i) => {
    if (v === null) { if (run.length) tsSegments.push(run); run = []; } else run.push(`${tsX(i).toFixed(1)},${tsY(v).toFixed(1)}`);
  });
  if (run.length) tsSegments.push(run);

  const flagText = (f) => {
    const dir = f.value > f.train_max ? 'above' : f.value < f.train_min ? 'below' : null;
    const name = VAR_LABEL[f.variable] || f.variable;
    const val = `${fmtVar(f.variable, f.value)} ${f.unit}`;
    if (f.level === 'outside') {
      return `${name} was ${val}, ${dir} everything in the model's training data (${fmtVar(f.variable, f.train_min)} to ${fmtVar(f.variable, f.train_max)} ${f.unit}).`;
    }
    const r = ranges && ranges[f.variable];
    const side = r && f.value > r.p995 ? 'high' : 'low';
    return `${name} was ${val}, in the extreme ${side} tail of the model's training data (beyond its 0.5–99.5% range${r ? ` of ${fmtVar(f.variable, r.p005)} to ${fmtVar(f.variable, r.p995)} ${f.unit}` : ''}).`;
  };

  const surfaceRows = month && month.surface_state ? [
    ['sst', month.surface_state.sst_c], ['ssh', month.surface_state.ssh_m],
    ['sss', month.surface_state.sss_psu], ['mld', month.surface_state.mld_m],
    ['curl', month.surface_state.wind_stress_curl], ['vorticity', month.surface_state.eddy_vorticity],
  ].filter(([, v]) => v !== undefined && v !== null) : [];

  return (
    <section className="rs-root" id="recent-seasons">
      <div className="rs-inner">
        <div className="rs-head">
          <div className="rs-kicker">RECENT SEASONS · NEAR-REAL-TIME</div>
          <h2 className="rs-title">Two years of real seasons, through the model</h2>
          <p className="rs-sub">
            Pick one of the five example points and scrub through {data.window.n_months} months of real satellite inputs
            ({monthLabel(data.window.first)} – {monthLabel(data.window.last)}, the 15th of each month) to watch the model&apos;s predicted
            temperature profile change with the seasons.
          </p>
        </div>

        <div className="rs-quality">
          <strong>NRT-BASED RECENT DATA:</strong> real near-real-time satellite and analysis inputs run through the trained model — not the
          fully quality-controlled data behind our official 0.637°C (Bay of Bengal) / 0.834°C (Arabian Sea) validation numbers, and not
          checked against Argo. These are predictions only; treat them as an illustration of seasonal patterns, not a measured record.
        </div>

        <div className="rs-chips" role="tablist" aria-label="Example point">
          {data.points.map((p, i) => (
            <button key={p.id} type="button" className={`rs-chip ${i === pointIdx ? 'active' : ''}`} onClick={() => { setPointIdx(i); setPlaying(false); }}>
              <span>{p.location.region.toUpperCase()}</span>
              <b>{p.location.lat.toFixed(2)}°N · {p.location.lon.toFixed(2)}°E</b>
            </button>
          ))}
        </div>

        <div className="rs-grid">
          <div className="rs-panel">
            <div className="rs-panel-label">PREDICTED PROFILE · {month ? monthLabelFull(month.date).toUpperCase() : ''}</div>
            <svg viewBox={`0 0 ${CH.w} ${CH.h}`} className="rs-chart" role="img" aria-label="Predicted temperature by depth for the selected month">
              {[0, 250, 500, 750, 1000].map((d) => (
                <g key={d}>
                  <line x1={CH.left} x2={CH.w - CH.right} y1={cy(d)} y2={cy(d)} stroke="#15799e" strokeWidth="0.5" opacity="0.35" />
                  <text x={CH.left - 5} y={cy(d) + 3} textAnchor="end" fontSize="8" fill="rgba(238,250,255,0.6)">{d}m</text>
                </g>
              ))}
              {[5, 10, 15, 20, 25, 30].map((t) => (
                <g key={t}>
                  <line x1={cx(t)} x2={cx(t)} y1={CH.top} y2={CH.h - CH.bottom} stroke="#15799e" strokeWidth="0.5" opacity="0.2" />
                  <text x={cx(t)} y={CH.h - CH.bottom + 11} textAnchor="middle" fontSize="8" fill="rgba(238,250,255,0.6)">{t}°</text>
                </g>
              ))}
              {months.map((m, i) => (m.predicted_temp_c && i !== monthIdx ? (
                <polyline key={i} points={profilePoints(depths, m.predicted_temp_c)} fill="none" stroke="#78CBE9" strokeWidth="0.8" opacity="0.13" />
              ) : null))}
              {sameMonthOthers.map((m) => (
                <polyline key={`o${m.date}`} points={profilePoints(depths, m.predicted_temp_c)} fill="none" stroke="#e28c31" strokeWidth="1.3" strokeDasharray="4 3" opacity="0.9" />
              ))}
              {month && month.predicted_temp_c && (
                <polyline points={profilePoints(depths, month.predicted_temp_c)} fill="none" stroke="#7ce0d0" strokeWidth="2.2" />
              )}
              {!(month && month.predicted_temp_c) && (
                <text x={CH.w / 2} y={CH.h / 2} textAnchor="middle" fontSize="9" fill="#e28c31">No real input for this month</text>
              )}
            </svg>
            <div className="rs-legend">
              <span><i className="sw cur" /> {month ? shortLabel(month.date).toUpperCase() : ''}</span>
              <span><i className="sw oth" /> SAME MONTH, OTHER YEARS</span>
              <span><i className="sw all" /> ALL OTHER MONTHS</span>
            </div>
          </div>

          <div className="rs-panel">
            <div className="rs-panel-label">MONTH</div>
            <div className="rs-controls">
              <button type="button" className="rs-btn" onClick={() => { setPlaying(false); setMonthIdx((i) => (i - 1 + nMonths) % nMonths); }} aria-label="Previous month">‹</button>
              <button type="button" className={`rs-btn rs-play ${playing ? 'on' : ''}`} onClick={() => setPlaying((p) => !p)}>{playing ? 'PAUSE' : 'PLAY'}</button>
              <button type="button" className="rs-btn" onClick={() => { setPlaying(false); setMonthIdx((i) => (i + 1) % nMonths); }} aria-label="Next month">›</button>
              <span className="rs-month">{month ? monthLabelFull(month.date) : ''}</span>
            </div>
            <input
              type="range" min="0" max={nMonths - 1} step="1" value={monthIdx}
              onChange={(e) => { setPlaying(false); setMonthIdx(Number(e.target.value)); }}
              className="rs-slider" aria-label="Month"
            />
            <div className="rs-ticks" aria-hidden="true">
              {months.map((m, i) => <i key={m.date} className={`rs-tick ${status(m)} ${i === monthIdx ? 'cur' : ''}`} title={`${monthLabel(m.date)}${status(m) === 'outside' ? ' — outside training range' : status(m) === 'edge' ? ' — edge of training range' : status(m) === 'unavailable' ? ' — no real input' : ''}`} />)}
            </div>
            <div className="rs-tick-key">
              <span><i className="rs-tick ok" /> within training range</span>
              <span><i className="rs-tick edge" /> edge of range</span>
              <span><i className="rs-tick outside" /> outside range</span>
              {counts.unavailable > 0 && <span><i className="rs-tick unavailable" /> no real input</span>}
            </div>
            <div className="rs-summary">
              {counts.outside + counts.edge === 0
                ? `All ${counts.ok} available months have inputs within the range the model was trained on.`
                : `${counts.outside} month${counts.outside === 1 ? '' : 's'} outside and ${counts.edge} at the edge of the model's training range, out of ${nMonths - counts.unavailable} — marked above.`}
            </div>

            {month && (st === 'outside' || st === 'edge') && (
              <div className={`rs-drift ${st}`} role="alert">
                <strong>{st === 'outside' ? 'OUTSIDE TRAINING RANGE' : 'AT THE EDGE OF TRAINING RANGE'}</strong>
                <span>The model has little or no precedent for this month&apos;s real inputs, so treat this profile with extra caution:</span>
                <ul>{month.flags.map((f) => <li key={f.variable}>{flagText(f)}</li>)}</ul>
              </div>
            )}
            {month && st === 'unavailable' && (
              <div className="rs-drift outside"><strong>NO REAL INPUT FOR THIS MONTH</strong><span>{month.unavailable_reason}. Nothing is estimated in its place.</span></div>
            )}

            {surfaceRows.length > 0 && (
              <div className="rs-facts">
                <div className="rs-facts-label">REAL INPUTS · {month.date}</div>
                {surfaceRows.map(([k, v]) => <div key={k}><span>{VAR_LABEL[k]}</span><strong>{fmtVar(k, v)} {VAR_UNIT[k]}</strong></div>)}
              </div>
            )}
          </div>

          <div className="rs-panel rs-ts">
            <div className="rs-panel-label">
              PREDICTED TEMPERATURE AT
              <select value={tsDepthIdx} onChange={(e) => setTsDepthIdx(Number(e.target.value))} className="rs-select" aria-label="Depth for the time series">
                {depths.map((d, i) => <option key={d} value={i}>{d} m</option>)}
              </select>
              OVER TIME
            </div>
            <svg viewBox={`0 0 ${TS.w} ${TS.h}`} className="rs-tschart" role="img" aria-label={`Predicted temperature at ${tsDepth} metres over the months`}>
              {[tsMin, (tsMin + tsMax) / 2, tsMax].map((v) => (
                <g key={v}>
                  <line x1={TS.left} x2={TS.w - TS.right} y1={tsY(v)} y2={tsY(v)} stroke="#15799e" strokeWidth="0.5" opacity="0.3" />
                  <text x={TS.left - 4} y={tsY(v) + 3} textAnchor="end" fontSize="8" fill="rgba(238,250,255,0.6)">{Math.round(v * 10) / 10}°</text>
                </g>
              ))}
              {months.map((m, i) => (parts(m.date).m === 0 || parts(m.date).m === 6 || i === 0) ? (
                <g key={m.date}>
                  <line x1={tsX(i)} x2={tsX(i)} y1={TS.top} y2={TS.h - TS.bottom} stroke="#15799e" strokeWidth="0.4" opacity="0.25" />
                  <text x={tsX(i)} y={TS.h - 8} textAnchor="middle" fontSize="7.5" fill="rgba(238,250,255,0.55)">{shortLabel(m.date)}</text>
                </g>
              ) : null)}
              {tsSegments.map((seg, i) => <polyline key={i} points={seg.join(' ')} fill="none" stroke="#7ce0d0" strokeWidth="1.6" />)}
              {months.map((m, i) => (series[i] !== null && (status(m) === 'outside' || status(m) === 'edge') ? (
                <circle key={`f${i}`} cx={tsX(i)} cy={tsY(series[i])} r="3" fill={status(m) === 'outside' ? '#e2685c' : '#e28c31'} />
              ) : null))}
              {series[monthIdx] !== null && (
                <>
                  <line x1={tsX(monthIdx)} x2={tsX(monthIdx)} y1={TS.top} y2={TS.h - TS.bottom} stroke="#fff" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.7" />
                  <circle cx={tsX(monthIdx)} cy={tsY(series[monthIdx])} r="3.6" fill="#fff" stroke="#7ce0d0" strokeWidth="1.5" />
                </>
              )}
            </svg>
            <div className="rs-legend">
              <span><i className="rs-dot outside" /> outside training range</span>
              <span><i className="rs-dot edge" /> edge of training range</span>
              <span className="rs-readout">{month && month.predicted_temp_c ? `${monthLabel(month.date)}: ${month.predicted_temp_c[tsDepthIdx].toFixed(2)}°C at ${tsDepth} m` : ''}</span>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .rs-root { width: 100%; display: flex; justify-content: center; margin-top: 3.5rem; color: #eefaff; }
        .rs-inner { width: 100%; max-width: 1600px; padding: 0 clamp(1.5rem, 6vw, 6.5rem); }
        .rs-head { margin-bottom: 1rem; }
        .rs-kicker { font: 600 0.7rem var(--font-public-sans), sans-serif; letter-spacing: 0.14em; color: #7ce0d0; }
        .rs-title { margin: 0.3rem 0 0.5rem; font: 700 clamp(1.6rem, 2.6vw, 2.3rem) var(--font-space-grotesk), sans-serif; color: #fff; letter-spacing: -0.01em; }
        .rs-sub { margin: 0; max-width: 760px; font-size: 0.85rem; line-height: 1.6; color: rgba(222, 244, 252, 0.72); }
        .rs-quality { padding: 0.7rem 0.9rem; margin-bottom: 1.1rem; background: rgba(226, 140, 49, 0.09); border: 1px solid rgba(226, 140, 49, 0.35); border-radius: 2px; font-size: 0.75rem; line-height: 1.55; color: rgba(238, 250, 255, 0.88); }
        .rs-quality strong { color: #f3c98b; }
        .rs-chips { display: flex; flex-wrap: wrap; gap: 0.6rem; margin-bottom: 1.1rem; }
        .rs-chip { display: flex; flex-direction: column; gap: 0.15rem; padding: 0.5rem 0.8rem; background: rgba(1, 7, 14, 0.6); border: 1px solid rgba(120, 203, 233, 0.15); border-radius: 2px; color: rgba(238, 250, 255, 0.7); cursor: pointer; text-align: left; transition: all 0.2s ease; }
        .rs-chip span { font: 600 0.52rem var(--font-space-grotesk), sans-serif; letter-spacing: 0.08em; color: #78CBE9; }
        .rs-chip b { font: 600 0.72rem var(--font-space-grotesk), sans-serif; color: inherit; }
        .rs-chip:hover { border-color: rgba(120, 203, 233, 0.4); color: #fff; }
        .rs-chip.active { background: rgba(120, 203, 233, 0.12); border-color: #7ce0d0; color: #fff; }
        .rs-grid { display: grid; grid-template-columns: minmax(280px, 1fr) minmax(300px, 1.1fr); gap: 1.2rem; align-items: start; }
        .rs-panel { background: rgba(4, 21, 38, 0.55); border: 1px solid rgba(120, 203, 233, 0.15); backdrop-filter: blur(10px); border-radius: 4px; padding: 1.1rem 1.2rem; display: flex; flex-direction: column; gap: 0.7rem; min-width: 0; }
        .rs-ts { grid-column: 1 / -1; }
        .rs-panel-label { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; font-size: 0.68rem; letter-spacing: 0.1em; color: #78CBE9; opacity: 0.9; }
        .rs-select { background: rgba(1, 7, 14, 0.7); color: #fff; border: 1px solid rgba(120, 203, 233, 0.3); border-radius: 2px; font: 600 0.65rem var(--font-space-grotesk), sans-serif; padding: 0.15rem 0.3rem; }
        .rs-chart { width: 100%; height: auto; max-height: 420px; background: rgba(1, 7, 14, 0.35); border: 1px solid rgba(120, 203, 233, 0.08); border-radius: 2px; }
        .rs-tschart { width: 100%; height: auto; max-height: 220px; background: rgba(1, 7, 14, 0.35); border: 1px solid rgba(120, 203, 233, 0.08); border-radius: 2px; }
        .rs-legend { display: flex; flex-wrap: wrap; gap: 0.5rem 1.1rem; font-size: 0.58rem; letter-spacing: 0.05em; color: rgba(238, 250, 255, 0.65); align-items: center; }
        .rs-legend span { display: flex; align-items: center; gap: 0.35rem; }
        .rs-readout { margin-left: auto; color: #fff; font-weight: 600; }
        .sw { display: inline-block; width: 14px; height: 2px; border-radius: 1px; }
        .sw.cur { background: #7ce0d0; height: 3px; }
        .sw.oth { background: repeating-linear-gradient(90deg, #e28c31 0 4px, transparent 4px 7px); }
        .sw.all { background: rgba(120, 203, 233, 0.35); }
        .rs-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; }
        .rs-dot.outside { background: #e2685c; }
        .rs-dot.edge { background: #e28c31; }
        .rs-controls { display: flex; align-items: center; gap: 0.5rem; }
        .rs-btn { min-width: 32px; height: 30px; padding: 0 0.6rem; background: rgba(1, 7, 14, 0.6); border: 1px solid rgba(120, 203, 233, 0.25); color: #78CBE9; border-radius: 2px; cursor: pointer; font: 600 0.62rem var(--font-space-grotesk), sans-serif; letter-spacing: 0.06em; }
        .rs-btn:hover { background: rgba(120, 203, 233, 0.15); color: #fff; }
        .rs-play.on { background: rgba(124, 224, 208, 0.2); border-color: #7ce0d0; color: #fff; }
        .rs-month { margin-left: auto; font: 600 1rem var(--font-space-grotesk), sans-serif; color: #fff; }
        .rs-slider { width: 100%; accent-color: #7ce0d0; cursor: pointer; margin: 0.2rem 0 0; }
        .rs-ticks { display: flex; justify-content: space-between; padding: 0 8px; margin-top: -0.2rem; }
        .rs-tick { display: inline-block; width: 5px; height: 9px; border-radius: 1px; background: rgba(120, 203, 233, 0.3); }
        .rs-tick.edge { background: #e28c31; }
        .rs-tick.outside { background: #e2685c; }
        .rs-tick.unavailable { background: transparent; border: 1px dashed rgba(238, 250, 255, 0.5); }
        .rs-tick.cur { box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.85); }
        .rs-tick-key { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; font-size: 0.56rem; color: rgba(238, 250, 255, 0.6); }
        .rs-tick-key span { display: flex; align-items: center; gap: 0.35rem; }
        .rs-summary { font-size: 0.68rem; line-height: 1.5; color: rgba(238, 250, 255, 0.75); }
        .rs-drift { display: flex; flex-direction: column; gap: 0.35rem; padding: 0.65rem 0.8rem; border-radius: 2px; font-size: 0.72rem; line-height: 1.5; }
        .rs-drift strong { font: 700 0.62rem var(--font-space-grotesk), sans-serif; letter-spacing: 0.08em; }
        .rs-drift ul { margin: 0; padding-left: 1.1rem; }
        .rs-drift.edge { background: rgba(226, 140, 49, 0.1); border: 1px solid rgba(226, 140, 49, 0.45); color: #f3c98b; }
        .rs-drift.edge strong { color: #e28c31; }
        .rs-drift.outside { background: rgba(226, 104, 92, 0.12); border: 1px solid rgba(226, 104, 92, 0.55); color: #f5b3ab; }
        .rs-drift.outside strong { color: #ff8b7e; }
        .rs-facts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem 1rem; }
        .rs-facts-label { grid-column: 1 / -1; font-size: 0.58rem; letter-spacing: 0.08em; color: #78CBE9; opacity: 0.8; }
        .rs-facts span { display: block; font-size: 0.55rem; letter-spacing: 0.05em; color: rgba(120, 203, 233, 0.75); }
        .rs-facts strong { font: 600 0.85rem var(--font-space-grotesk), sans-serif; color: #fff; }
        @media (max-width: 900px) { .rs-grid { grid-template-columns: 1fr; } .rs-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
      `}</style>
    </section>
  );
}
