'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';

// Real Argo float drift track. Pick or search one real float ID and see its
// actual real path on the map across several real months.
//
//   - The path is ONLY real fixes: every stop is one real profile report from
//     the real Argo global profile index, at that report's own real date and
//     coordinates (/api/argo-float-track). Straight lines join consecutive real
//     fixes; the float's movement between two reports isn't known and nothing
//     is interpolated or invented between them.
//   - The model's prediction at a stop comes from the SAME real exact-date
//     comparison the Recent Validation Calendar uses (/api/argo-date-comparison
//     /stream): real satellite inputs for that spot and date, run through the
//     trained model, compared with that profile's real measurements. It's slow
//     (~20-60 s per stop), so it runs on demand, one stop at a time.
//   - A stop outside the models' real coverage, or a date before the satellite
//     data starts, shows its real position and an honest "no prediction" - never
//     a guess.

const API_BASE = process.env.NEXT_PUBLIC_LIVE_API_BASE || 'http://localhost:8000';
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (iso) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || ''); return m ? `${MONTH_ABBR[+m[2] - 1]} ${+m[3]}, ${m[1]}` : iso; };
const MODE_LABEL = { 'real-time': 'Real-time (R)', 'delayed-mode': 'Delayed-mode (D)' };
const QUALITY_LABEL = {
  'real-time': 'Real-time Argo data (not our official quality-controlled validation set)',
  'delayed-mode': 'Delayed-mode (quality-controlled) Argo profile, but a single float, not our official aggregate validation numbers',
};
const SAMPLE_COUNT = 8;

export function useFloatTrack() {
  const [open, setOpen] = useState(false);
  const [idInput, setIdInput] = useState('');
  const [months, setMonths] = useState(12);
  const [suggestions, setSuggestions] = useState({ loaded: false, loading: false, error: null, floats: [] });
  const [track, setTrack] = useState({ loading: false, error: null, data: null });
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [runs, setRuns] = useState({}); // stop.file -> { status, steps, result, error }
  const [batch, setBatch] = useState({ running: false, total: 0, done: 0 });

  const trackRef = useRef(null);
  trackRef.current = track.data;
  const queueRef = useRef([]);
  const activeRef = useRef(null); // { source, file }
  const genRef = useRef(0);       // bumps whenever the track changes, so stale results are ignored
  const runsRef = useRef({});
  runsRef.current = runs;

  const stopAll = useCallback(() => {
    queueRef.current = [];
    if (activeRef.current) { activeRef.current.source.close(); activeRef.current = null; }
  }, []);

  useEffect(() => () => stopAll(), [stopAll]);

  // Suggested floats: fetched the first time the panel is opened.
  useEffect(() => {
    if (!open || suggestions.loaded || suggestions.loading) return;
    setSuggestions((s) => ({ ...s, loading: true }));
    fetch(`${API_BASE}/api/argo-float-suggestions?region=both`)
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((d) => setSuggestions({ loaded: true, loading: false, error: null, floats: d.floats || [] }))
      .catch(() => setSuggestions({ loaded: false, loading: false, error: 'Could not load suggested floats. Is the backend running?', floats: [] }));
  }, [open, suggestions.loaded, suggestions.loading]);

  const pump = useCallback(() => {
    if (activeRef.current) return;
    const data = trackRef.current;
    const idx = queueRef.current.shift();
    if (idx === undefined || !data) { setBatch((b) => ({ ...b, running: false })); return; }
    const stop = data.stops[idx];
    const gen = genRef.current;
    const setRun = (patch) => { if (gen === genRef.current) setRuns((r) => ({ ...r, [stop.file]: { ...(r[stop.file] || {}), ...patch } })); };
    const advance = () => { setBatch((b) => ({ ...b, done: Math.min(b.total, b.done + 1) })); pump(); };

    if (!stop.region) {
      setRun({ status: 'error', error: "This stop is outside the models' real coverage, so there is no prediction for it. Its real position is still shown." });
      advance();
      return;
    }
    setRun({ status: 'loading', steps: [] });
    const source = new EventSource(`${API_BASE}/api/argo-date-comparison/stream?lat=${stop.lat}&lon=${stop.lon}&date=${stop.date}`);
    activeRef.current = { source, file: stop.file };
    const finish = (patch) => { source.close(); if (activeRef.current && activeRef.current.source === source) activeRef.current = null; setRun(patch); advance(); };
    source.onmessage = (event) => {
      const u = JSON.parse(event.data);
      if (u.step === 'error') finish({ status: 'error', error: u.error || 'Comparison failed.' });
      else if (u.done) {
        // Two different floats can report from the same spot on the same day;
        // never show another float's profile as this one's.
        if (u.result && u.result.float && u.result.float.float_id !== data.float_id) {
          finish({ status: 'error', error: 'The comparison matched a different float that reported from the same spot on the same day, so it is not shown.' });
        } else finish({ status: 'done', result: u.result });
      } else if (gen === genRef.current) setRuns((r) => ({ ...r, [stop.file]: { ...(r[stop.file] || {}), steps: [...((r[stop.file] || {}).steps || []), u.step] } }));
    };
    source.onerror = () => finish({ status: 'error', error: 'Could not reach the comparison service. Is the backend running?' });
  }, []);

  const enqueue = useCallback((idx, front) => {
    const data = trackRef.current;
    if (!data) return;
    const file = data.stops[idx].file;
    if (runsRef.current[file] || (activeRef.current && activeRef.current.file === file) || queueRef.current.includes(idx)) return;
    if (front) queueRef.current.unshift(idx); else queueRef.current.push(idx);
    pump();
  }, [pump]);

  const loadTrack = useCallback((floatId, m) => {
    const id = String(floatId || '').trim();
    stopAll();
    genRef.current += 1;
    setRuns({}); setBatch({ running: false, total: 0, done: 0 }); setSelectedIdx(null);
    setTrack({ loading: true, error: null, data: null });
    fetch(`${API_BASE}/api/argo-float-track?float_id=${encodeURIComponent(id)}&months=${m}`)
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.detail || `HTTP ${r.status}`);
        return body;
      })
      .then((d) => {
        if (d.error) setTrack({ loading: false, error: d.error, data: null });
        else setTrack({ loading: false, error: null, data: d });
      })
      .catch((e) => setTrack({ loading: false, error: e.message === 'Failed to fetch' ? 'Could not reach the backend. Is it running?' : e.message, data: null }));
  }, [stopAll]);

  const select = useCallback((idx) => { setSelectedIdx(idx); enqueue(idx, true); }, [enqueue]);

  const predictSample = useCallback(() => {
    const data = trackRef.current;
    if (!data) return;
    const cand = data.stops.map((s, i) => (s.region ? i : -1)).filter((i) => i >= 0);
    if (cand.length === 0) return;
    const k = Math.min(SAMPLE_COUNT, cand.length);
    const picks = [...new Set(Array.from({ length: k }, (_, j) => cand[Math.round((j * (cand.length - 1)) / Math.max(1, k - 1))]))]
      .filter((i) => !runsRef.current[data.stops[i].file]);
    if (picks.length === 0) return;
    setBatch({ running: true, total: picks.length, done: 0 });
    picks.forEach((i) => enqueue(i, false));
  }, [enqueue]);

  const cancel = useCallback(() => {
    const active = activeRef.current;
    stopAll();
    if (active) setRuns((r) => { const n = { ...r }; delete n[active.file]; return n; });
    setBatch({ running: false, total: 0, done: 0 });
  }, [stopAll]);

  const reset = useCallback(() => {
    stopAll(); genRef.current += 1;
    setRuns({}); setBatch({ running: false, total: 0, done: 0 }); setSelectedIdx(null);
    setTrack({ loading: false, error: null, data: null });
  }, [stopAll]);

  const toggle = () => setOpen((o) => !o);
  const close = () => setOpen(false);

  return {
    open, toggle, close, reset, idInput, setIdInput, months, setMonths, suggestions, track, loadTrack,
    selectedIdx, select, runs, batch, predictSample, cancel,
    stops: open && track.data ? track.data.stops : [],
  };
}

// ---- SVG layer drawn on the existing map (pointer-events only on the stops) ----
export function FloatTrackSvgLayer({ ft, projection }) {
  if (!ft.open || !ft.track.data || !projection) return null;
  const stops = ft.track.data.stops
    .map((s, i) => { const p = projection([s.lon, s.lat]); return p ? { ...s, i, x: p[0], y: p[1] } : null; })
    .filter(Boolean);
  if (stops.length === 0) return null;
  const n = stops.length;
  // older -> newer: cool blue to warm amber
  const colour = (i) => { const t = n === 1 ? 1 : i / (n - 1); return `rgb(${Math.round(120 + 123 * t)},${Math.round(203 - 3 * t)},${Math.round(233 - 94 * t)})`; };
  const first = stops[0], last = stops[n - 1];
  return (
    <g className="ft-layer">
      {stops.slice(1).map((s, k) => (
        <line key={`l${k}`} x1={stops[k].x} y1={stops[k].y} x2={s.x} y2={s.y} stroke={colour(k + 1)} strokeWidth="1.3" opacity="0.85" style={{ pointerEvents: 'none' }} />
      ))}
      {stops.map((s) => {
        const run = ft.runs[s.file];
        const active = s.i === ft.selectedIdx;
        const covered = !!s.region;
        return (
          <g key={s.file} className="ft-stop" transform={`translate(${s.x}, ${s.y})`}
             onClick={(e) => { e.stopPropagation(); ft.select(s.i); }} style={{ cursor: 'pointer' }}>
            <title>{`Float ${ft.track.data.float_id} · cycle ${s.cycle ?? '?'} · ${fmtDate(s.date)} ${s.time_utc} UTC · ${s.lat.toFixed(2)}°N ${s.lon.toFixed(2)}°E · ${MODE_LABEL[s.data_mode]}${covered ? '' : " · outside the models' coverage"}${run && run.status === 'done' ? ` · predicted ${run.result.profile.predicted_temp_c[0]}°C at the surface` : ''}`}</title>
            <circle r="7" fill="transparent" />
            {active && <circle r="8" fill="#fff" opacity="0.18" />}
            <circle r={active ? 4.6 : 3} fill={covered ? colour(s.i) : 'rgba(1,7,14,0.5)'} stroke={active ? '#fff' : colour(s.i)} strokeWidth={active ? 1.6 : 1.1} strokeDasharray={covered ? undefined : '1.6 1.2'} />
            {run && run.status === 'done' && <circle r="6" fill="none" stroke="#7ce0d0" strokeWidth="1" />}
          </g>
        );
      })}
      <text x={first.x} y={first.y - 8} textAnchor="middle" fontSize="6.5" fill="#eefaff" style={{ pointerEvents: 'none' }} stroke="rgba(1,7,14,0.75)" strokeWidth="2" paintOrder="stroke">{`START ${fmtDate(first.date)}`}</text>
      {n > 1 && <text x={last.x} y={last.y + 13} textAnchor="middle" fontSize="6.5" fill="#f3c98b" style={{ pointerEvents: 'none' }} stroke="rgba(1,7,14,0.75)" strokeWidth="2" paintOrder="stroke">{`LATEST ${fmtDate(last.date)}`}</text>}
    </g>
  );
}

// ---- Popover over the map: search + suggestions + summary ----
const FTP_CSS = `
        .ftp { position: absolute; top: 1.5rem; right: 4.6rem; z-index: 12; width: 270px; max-height: calc(100% - 3rem); overflow-y: auto; display: flex; flex-direction: column; gap: 0.55rem; padding: 0.8rem 0.9rem; background: rgba(4, 21, 38, 0.94); border: 1px solid rgba(120, 203, 233, 0.25); backdrop-filter: blur(6px); border-radius: 3px; box-shadow: 0 4px 24px rgba(1, 7, 14, 0.6); color: #eefaff; }
        .ftp-top { display: flex; justify-content: space-between; align-items: center; }
        .ftp-kicker { font: 600 0.55rem var(--font-space-grotesk), sans-serif; letter-spacing: 0.1em; color: #7ce0d0; }
        .ftp-x { width: 20px; height: 20px; background: transparent; border: 0; color: #78CBE9; font-size: 1.1rem; line-height: 1; cursor: pointer; }
        .ftp-form { display: flex; gap: 0.4rem; }
        .ftp-input { flex: 1; min-width: 0; background: rgba(1, 7, 14, 0.7); border: 1px solid rgba(120, 203, 233, 0.3); color: #fff; border-radius: 2px; padding: 0.4rem 0.5rem; font: 500 0.72rem var(--font-space-grotesk), sans-serif; }
        .ftp-go, .ftp-btn { background: rgba(124, 224, 208, 0.14); border: 1px solid #7ce0d0; color: #eefaff; border-radius: 2px; padding: 0.4rem 0.7rem; font: 600 0.58rem var(--font-space-grotesk), sans-serif; letter-spacing: 0.06em; cursor: pointer; }
        .ftp-go:hover, .ftp-btn:hover { background: rgba(124, 224, 208, 0.28); }
        .ftp-go:disabled { opacity: 0.5; cursor: wait; }
        .ftp-cancel { border-color: #e28c31; background: rgba(226, 140, 49, 0.14); }
        .ftp-secondary { border-color: rgba(120, 203, 233, 0.4); background: rgba(120, 203, 233, 0.08); }
        .ftp-actions { flex-wrap: wrap; gap: 0.4rem; }
        .ftp-compact { width: 235px; gap: 0.45rem; }
        .ftp-months { display: flex; align-items: center; gap: 0.4rem; font-size: 0.55rem; letter-spacing: 0.06em; color: rgba(238, 250, 255, 0.65); }
        .ftp-months select { background: rgba(1, 7, 14, 0.7); color: #fff; border: 1px solid rgba(120, 203, 233, 0.3); border-radius: 2px; font: 600 0.62rem var(--font-space-grotesk), sans-serif; padding: 0.1rem 0.25rem; }
        .ftp-disclose { align-self: flex-start; background: transparent; border: 0; padding: 0; color: #78CBE9; font: 600 0.55rem var(--font-space-grotesk), sans-serif; letter-spacing: 0.08em; cursor: pointer; }
        .ftp-disclose:hover { color: #fff; }
        .ftp-sub { font-size: 0.55rem; letter-spacing: 0.08em; color: #78CBE9; opacity: 0.85; margin-bottom: 0.3rem; }
        .ftp-chips { display: flex; flex-direction: column; gap: 0.3rem; }
        .ftp-chip { display: flex; justify-content: space-between; align-items: baseline; gap: 0.5rem; padding: 0.35rem 0.5rem; background: rgba(1, 7, 14, 0.55); border: 1px solid rgba(120, 203, 233, 0.18); border-radius: 2px; color: #eefaff; cursor: pointer; text-align: left; }
        .ftp-chip:hover { border-color: #7ce0d0; background: rgba(124, 224, 208, 0.1); }
        .ftp-chip b { font: 600 0.72rem var(--font-space-grotesk), sans-serif; }
        .ftp-chip span { font-size: 0.55rem; color: rgba(238, 250, 255, 0.65); }
        .ftp-summary { display: flex; flex-direction: column; gap: 0.35rem; font-size: 0.64rem; line-height: 1.45; color: rgba(238, 250, 255, 0.85); }
        .ftp-summary b { color: #fff; }
        .ftp-legend { display: flex; align-items: center; gap: 0.35rem; font-size: 0.55rem; color: rgba(238, 250, 255, 0.65); }
        .ftp-grad { display: inline-block; width: 36px; height: 4px; border-radius: 2px; background: linear-gradient(90deg, rgb(120,203,233), rgb(243,200,139)); }
        .ftp-ring { display: inline-block; width: 9px; height: 9px; border-radius: 50%; border: 1px solid #7ce0d0; }
        .ftp-actions { display: flex; }
        .ftp-muted { font-size: 0.58rem; color: rgba(238, 250, 255, 0.6); }
        .ftp-err { font-size: 0.66rem; line-height: 1.45; color: #e28c31; }
        .ftp-note { padding: 0.4rem 0.5rem; font-size: 0.55rem; line-height: 1.4; background: rgba(226, 140, 49, 0.09); border: 1px solid rgba(226, 140, 49, 0.3); border-radius: 2px; color: rgba(243, 201, 139, 0.9); }
        @media (max-width: 700px) { .ftp { left: 1rem; right: 4.2rem; width: auto; } }
`;

export function FloatTrackPopover({ ft, projection }) {
  const data = ft.track.data;
  const [showSugg, setShowSugg] = useState(false);
  // Stops whose real position falls beyond the edge of this map view.
  const nOffMap = data && projection ? data.stops.filter((s) => { const p = projection([s.lon, s.lat]); return !p || p[0] < 0 || p[0] > 800 || p[1] < 0 || p[1] > 500; }).length : 0;
  const nOut = data ? data.stops.filter((s) => !s.region).length : 0;
  const nR = data ? data.stops.filter((s) => s.data_mode === 'real-time').length : 0;
  const go = (e) => { e.preventDefault(); if (ft.idInput.trim()) ft.loadTrack(ft.idInput, ft.months); };
  const pick = (id) => { ft.setIdInput(id); ft.loadTrack(id, ft.months); };
  const busy = ft.batch.running;
  const nSample = data ? Math.min(SAMPLE_COUNT, data.stops.filter((s) => s.region).length) : 0;

  // Once a float is loaded the popover shrinks to a small pill so it never
  // hides the path it just drew; details live in the panel under the map.
  if (data) {
    return (
      <div className="ftp ftp-compact" role="dialog" aria-label="Real Argo float drift path">
        <div className="ftp-top">
          <span className="ftp-kicker">FLOAT {data.float_id} · {data.n_stops} REAL REPORTS</span>
          <button type="button" className="ftp-x" onClick={ft.close} aria-label="Close">×</button>
        </div>
        <div className="ftp-legend"><i className="ftp-grad" /> older → newer · <i className="ftp-ring" /> prediction ready</div>
        <div className="ftp-actions">
          {!busy && nSample > 0 && <button type="button" className="ftp-btn" onClick={ft.predictSample}>PREDICT {nSample} STOPS</button>}
          {busy && <button type="button" className="ftp-btn ftp-cancel" onClick={ft.cancel}>CANCEL ({ft.batch.done}/{ft.batch.total})</button>}
          <button type="button" className="ftp-btn ftp-secondary" onClick={ft.reset}>NEW SEARCH</button>
        </div>
        {nOffMap > 0 && <div className="ftp-err">{nOffMap === data.n_stops ? 'All' : nOffMap} real position{nOffMap === 1 ? '' : 's'} lie beyond this map&apos;s edge (listed below).</div>}
        <div className="ftp-muted">Click a stop to predict it (~20–60 s). Details below the map.</div>
        <style>{FTP_CSS}</style>
      </div>
    );
  }

  return (
    <div className="ftp" role="dialog" aria-label="Real Argo float drift path">
      <div className="ftp-top">
        <span className="ftp-kicker">TRACK ONE REAL ARGO FLOAT</span>
        <button type="button" className="ftp-x" onClick={ft.close} aria-label="Close">×</button>
      </div>
      <form className="ftp-form" onSubmit={go}>
        <input className="ftp-input" value={ft.idInput} onChange={(e) => ft.setIdInput(e.target.value)} placeholder="Float ID, e.g. 7902069" inputMode="numeric" aria-label="Argo float ID" />
        <button type="submit" className="ftp-go" disabled={ft.track.loading}>GO</button>
      </form>
      <label className="ftp-months">LAST
        <select value={ft.months} onChange={(e) => ft.setMonths(Number(e.target.value))}>
          {[3, 6, 12, 24].map((m) => <option key={m} value={m}>{m} months</option>)}
        </select>
        OF ITS REAL RECORD
      </label>
      <div className="ftp-muted">Tip: switch on ARGO in the map controls, then hover any dot to read a real float ID.</div>
      <button type="button" className="ftp-disclose" onClick={() => setShowSugg((v) => !v)} aria-expanded={showSugg}>{showSugg ? '▾' : '▸'} SUGGESTED FLOATS THAT DRIFT FAR</button>
      {showSugg && (
        <div className="ftp-sugg">
          {ft.suggestions.loading && <span className="ftp-muted">Loading real floats…</span>}
          {ft.suggestions.error && <span className="ftp-err">{ft.suggestions.error}</span>}
          <div className="ftp-chips">
            {ft.suggestions.floats.map((f) => (
              <button key={f.float_id} type="button" className="ftp-chip" onClick={() => pick(f.float_id)} title={`${f.n_profiles} real profiles, ${fmtDate(f.first)} to ${fmtDate(f.last)}`}>
                <b>{f.float_id}</b><span>{f.region === 'Arabian Sea' ? 'Arabian' : 'Bay'} · {f.drift_span_deg}° drift</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {ft.track.loading && <span className="ftp-muted">Loading the float&apos;s real positions…</span>}
      {ft.track.error && <div className="ftp-err">{ft.track.error}</div>}

      <style>{FTP_CSS}</style>
    </div>
  );
}

// ---- Panel under the map: every stop + the selected stop's prediction ----
const CH = { w: 300, h: 240, left: 40, right: 12, top: 12, bottom: 28, tMin: 5, tMax: 32, dMax: 1000 };
const cxT = (t) => CH.left + ((Math.min(Math.max(t, CH.tMin), CH.tMax) - CH.tMin) / (CH.tMax - CH.tMin)) * (CH.w - CH.left - CH.right);
const cyD = (d) => CH.top + (d / CH.dMax) * (CH.h - CH.top - CH.bottom);
function segments(depths, temps) {
  const out = []; let run = [];
  temps.forEach((t, i) => { if (t === null || t === undefined) { if (run.length) out.push(run); run = []; } else run.push([cxT(t), cyD(depths[i])]); });
  if (run.length) out.push(run);
  return out;
}

function StopComparison({ stop, run, floatId }) {
  const [depthIdx, setDepthIdx] = useState(0);
  const result = run && run.status === 'done' ? run.result : null;
  const measured = result ? result.profile.argo_temp_c.map((v, i) => (v !== null && v !== undefined ? i : -1)).filter((i) => i >= 0) : [];
  const firstIdx = measured.length ? measured[0] : 0;
  const lastIdx = measured.length ? measured[measured.length - 1] : 0;
  useEffect(() => { if (result) setDepthIdx(firstIdx); }, [result]); // eslint-disable-line react-hooks/exhaustive-deps
  const segs = result ? { p: segments(result.profile.depths_m, result.profile.predicted_temp_c), a: segments(result.profile.depths_m, result.profile.argo_temp_c) } : null;
  const sel = result ? { d: result.profile.depths_m[depthIdx], p: result.profile.predicted_temp_c[depthIdx], a: result.profile.argo_temp_c[depthIdx] } : null;
  const limited = result && result.n_depths_overlap !== undefined && result.n_depths_overlap < 14;
  return (
    <div className="ftc">
      <div className="ftc-facts">
        <div><span>FLOAT</span><strong>{floatId} · cycle {stop.cycle ?? '?'}</strong></div>
        <div><span>REAL REPORT</span><strong>{fmtDate(stop.date)} · {stop.time_utc} UTC</strong></div>
        <div><span>REAL POSITION</span><strong>{stop.lat.toFixed(3)}°N · {stop.lon.toFixed(3)}°E</strong></div>
        <div><span>REGION</span><strong>{stop.region || 'Outside model coverage'}</strong></div>
        <div className={`ftc-mode ${stop.data_mode}`}>{QUALITY_LABEL[stop.data_mode]}</div>
      </div>

      {!run && stop.region && <div className="ftc-empty">Click this stop (or use PREDICT STOPS) to compute the model&apos;s prediction for this real spot and date. It takes about 20–60 s.</div>}
      {!run && !stop.region && <div className="ftc-error">NO PREDICTION — this stop is outside the models&apos; real coverage. Its real position is still shown on the map.</div>}
      {run && run.status === 'loading' && (
        <ul className="ftc-steps">{(run.steps || []).map((s, i, arr) => <li key={i} className={i === arr.length - 1 ? 'active' : 'done'}><span className="ftc-icon" />{s}</li>)}</ul>
      )}
      {run && run.status === 'error' && <div className="ftc-error">NO PREDICTION FOR THIS STOP — {run.error}</div>}

      {result && segs && (
        <div className="ftc-result">
          <div>
            <svg viewBox={`0 0 ${CH.w} ${CH.h}`} className="ftc-chart" role="img" aria-label="Predicted versus Argo temperature by depth at this stop">
              {[0, 250, 500, 750, 1000].map((d) => (<g key={d}><line x1={CH.left} x2={CH.w - CH.right} y1={cyD(d)} y2={cyD(d)} stroke="#15799e" strokeWidth="0.5" opacity="0.35" /><text x={CH.left - 5} y={cyD(d) + 3} textAnchor="end" fontSize="8" fill="rgba(238,250,255,0.6)">{d}m</text></g>))}
              {[5, 10, 15, 20, 25, 30].map((t) => (<g key={t}><line x1={cxT(t)} x2={cxT(t)} y1={CH.top} y2={CH.h - CH.bottom} stroke="#15799e" strokeWidth="0.5" opacity="0.2" /><text x={cxT(t)} y={CH.h - CH.bottom + 12} textAnchor="middle" fontSize="8" fill="rgba(238,250,255,0.6)">{t}°</text></g>))}
              {sel && <g><line x1={CH.left} x2={CH.w - CH.right} y1={cyD(sel.d)} y2={cyD(sel.d)} stroke="#eefaff" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.7" />
                {sel.p != null && <circle cx={cxT(sel.p)} cy={cyD(sel.d)} r="4.5" fill="none" stroke="#7ce0d0" strokeWidth="1.6" />}
                {sel.a != null && <circle cx={cxT(sel.a)} cy={cyD(sel.d)} r="4.5" fill="none" stroke="#e28c31" strokeWidth="1.6" />}</g>}
              {segs.p.map((sg, i) => <polyline key={`p${i}`} points={sg.map((p) => p.join(',')).join(' ')} fill="none" stroke="#7ce0d0" strokeWidth="1.8" />)}
              {segs.a.map((sg, i) => (<g key={`a${i}`}><polyline points={sg.map((p) => p.join(',')).join(' ')} fill="none" stroke="#e28c31" strokeWidth="1.5" strokeDasharray="4 3" />{sg.map((p, j) => <circle key={j} cx={p[0]} cy={p[1]} r="2" fill="#e28c31" />)}</g>))}
            </svg>
            <div className="ftc-legend"><span><i className="sw p" /> OCEANEMBED PREDICTION</span><span><i className="sw a" /> REAL ARGO PROFILE</span></div>
          </div>
          <div className="ftc-side">
            <div className="ftc-depth">
              <div className="ftc-depth-head"><span>DEPTH</span><strong>{sel.d} m</strong></div>
              <input type="range" min={firstIdx} max={lastIdx} step="1" value={Math.min(Math.max(depthIdx, firstIdx), lastIdx)} onChange={(e) => setDepthIdx(Number(e.target.value))} disabled={firstIdx === lastIdx} className="ftc-slider" aria-label="Depth to inspect" />
              <div className="ftc-readout">
                <div><span>PREDICTED</span><strong className="p">{sel.p == null ? '—' : `${sel.p.toFixed(2)}°C`}</strong></div>
                <div><span>REAL ARGO</span><strong className="a">{sel.a == null ? 'not measured' : `${sel.a.toFixed(2)}°C`}</strong></div>
                <div><span>DIFFERENCE</span><strong>{sel.a == null || sel.p == null ? '—' : `${sel.p - sel.a >= 0 ? '+' : ''}${(sel.p - sel.a).toFixed(2)}°C`}</strong></div>
              </div>
            </div>
            {limited && <div className="ftc-note">Limited profile: this float only measured {result.argo_measured_range_dbar ? `${Math.round(result.argo_measured_range_dbar[0])}–${Math.round(result.argo_measured_range_dbar[1])} dbar` : 'part of the water column'} at this stop, so only {result.n_depths_overlap} of the model&apos;s 15 depths can be compared.</div>}
            {result.metrics ? (
              <div className="ftc-metrics">
                <div><span>RMSE</span><strong>{result.metrics.rmse_c.toFixed(2)}°C</strong></div>
                <div><span>BIAS</span><strong>{result.metrics.bias_c.toFixed(2)}°C</strong></div>
                <div><span>CORRELATION</span><strong>{result.metrics.correlation === null ? '—' : result.metrics.correlation.toFixed(3)}</strong></div>
                <div><span>DEPTHS COMPARED</span><strong>{result.metrics.n_depths} / 15</strong></div>
              </div>
            ) : <div className="ftc-note">Too few real measurements at this stop for summary metrics.</div>}
            <p className="ftc-caption">Model inputs are real satellite data for {fmtDate(result.date)} at this exact spot. A spot-check against this one profile, not our official validation numbers.</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function FloatTrackPanel({ ft }) {
  const panelRef = useRef(null);
  const data = ft.track.data;
  useEffect(() => { if (ft.selectedIdx !== null) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [ft.selectedIdx]);
  if (!ft.open || !data) return null;
  const sel = ft.selectedIdx !== null ? data.stops[ft.selectedIdx] : null;
  const top = (run) => { if (!run || run.status !== 'done') return null; const a = run.result.profile.argo_temp_c.find((v) => v !== null && v !== undefined); return a === undefined ? null : a; };
  return (
    <div className="ftpanel" ref={panelRef}>
      <div className="ftpanel-label">REAL DRIFT PATH OF FLOAT {data.float_id} · MODEL PREDICTION AT EACH REAL STOP</div>
      <div className="ftpanel-summary">
        <div><b>{data.n_stops} real reports</b>, {fmtDate(data.window.first)} – {fmtDate(data.window.last)} (of {data.total_profiles_in_index} in the float&apos;s whole record, {fmtDate(data.record.first)} – {fmtDate(data.record.last)}). Real positions span {data.extent.lat[0].toFixed(1)}–{data.extent.lat[1].toFixed(1)}°N, {data.extent.lon[0].toFixed(1)}–{data.extent.lon[1].toFixed(1)}°E.</div>
        <div>{data.stops.filter((s) => s.data_mode === 'real-time').length} real-time (R) and {data.stops.filter((s) => s.data_mode !== 'real-time').length} delayed-mode (D) profiles.{data.stops.some((s) => !s.region) ? ` ${data.stops.filter((s) => !s.region).length} stop(s) are outside the models' real coverage (no prediction possible; hollow on the map).` : ''}{data.profiles_without_position > 0 ? ` ${data.profiles_without_position} report(s) have no recorded position and are left out.` : ''}</div>
        <div className="ftpanel-note">Positions are real Argo reports. Straight lines on the map only join consecutive real fixes; the float&apos;s movement between reports isn&apos;t known and nothing is interpolated. Predictions use real satellite inputs for each stop&apos;s spot and date; recent (real-time) profiles aren&apos;t quality-controlled and this is not our official validation.</div>
      </div>
      <div className="ftpanel-grid">
        <div className="ftlist" role="list">
          <div className="ftlist-head"><span>DATE</span><span>REAL POSITION</span><span>MODE</span><span>PRED. 0 m</span><span>ARGO 0 m</span></div>
          {data.stops.map((s, i) => {
            const run = ft.runs[s.file];
            const done = run && run.status === 'done';
            return (
              <button type="button" key={s.file} role="listitem" className={`ftrow ${i === ft.selectedIdx ? 'sel' : ''} ${s.region ? '' : 'out'}`} onClick={() => ft.select(i)}>
                <span>{fmtDate(s.date)}</span>
                <span>{s.lat.toFixed(2)}°N {s.lon.toFixed(2)}°E</span>
                <span>{s.data_mode === 'real-time' ? 'R' : 'D'}</span>
                <span className="p">{done ? `${run.result.profile.predicted_temp_c[0]}°C` : (run && run.status === 'loading' ? '…' : (run && run.status === 'error' ? 'n/a' : (s.region ? '' : 'no cover')))}</span>
                <span className="a">{done && top(run) !== null ? `${top(run).toFixed(2)}°C` : ''}</span>
              </button>
            );
          })}
        </div>
        <div>
          {sel ? <StopComparison stop={sel} run={ft.runs[sel.file]} floatId={data.float_id} /> : <div className="ftc-empty">Click a stop on the map or in the list to see the model&apos;s prediction for that real spot and date, next to what the float really measured.</div>}
        </div>
      </div>
      <style>{`
        .ftpanel { margin-top: 1rem; padding: 1.1rem 1.2rem; display: flex; flex-direction: column; gap: 0.8rem; background: rgba(4, 21, 38, 0.55); border: 1px solid rgba(120, 203, 233, 0.15); backdrop-filter: blur(10px); border-radius: 4px; color: #eefaff; }
        .ftpanel-summary { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.72rem; line-height: 1.5; color: rgba(238, 250, 255, 0.82); }
        .ftpanel-summary b { color: #fff; }
        .ftpanel-note { padding: 0.5rem 0.65rem; font-size: 0.66rem; line-height: 1.5; background: rgba(226, 140, 49, 0.09); border: 1px solid rgba(226, 140, 49, 0.35); border-radius: 2px; color: rgba(243, 201, 139, 0.92); }
        .ftpanel-label { font-size: 0.68rem; letter-spacing: 0.1em; color: #78CBE9; opacity: 0.9; }
        .ftpanel-grid { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1.25fr); gap: 1.3rem; align-items: start; }
        .ftlist { max-height: 470px; overflow-y: auto; display: flex; flex-direction: column; gap: 2px; border: 1px solid rgba(120, 203, 233, 0.1); border-radius: 2px; background: rgba(1, 7, 14, 0.3); }
        .ftlist-head, .ftrow { display: grid; grid-template-columns: 1.15fr 1.5fr 0.35fr 0.75fr 0.75fr; gap: 0.4rem; padding: 0.3rem 0.5rem; font-size: 0.62rem; align-items: center; }
        .ftlist-head { position: sticky; top: 0; background: rgba(4, 21, 38, 0.97); font-size: 0.5rem; letter-spacing: 0.06em; color: #78CBE9; z-index: 1; }
        .ftrow { background: transparent; border: 0; border-left: 2px solid transparent; color: rgba(238, 250, 255, 0.85); cursor: pointer; text-align: left; font-family: var(--font-space-grotesk), sans-serif; }
        .ftrow:hover { background: rgba(120, 203, 233, 0.08); }
        .ftrow.sel { background: rgba(124, 224, 208, 0.12); border-left-color: #7ce0d0; color: #fff; }
        .ftrow.out { color: rgba(238, 250, 255, 0.45); font-style: italic; }
        .ftrow .p { color: #7ce0d0; font-weight: 600; } .ftrow .a { color: #e28c31; font-weight: 600; }
        .ftc { display: flex; flex-direction: column; gap: 0.8rem; }
        .ftc-facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.6rem 1rem; }
        .ftc-facts > div span { display: block; font-size: 0.55rem; letter-spacing: 0.08em; color: #78CBE9; opacity: 0.7; margin-bottom: 0.15rem; }
        .ftc-facts > div strong { font: 500 0.8rem var(--font-space-grotesk), sans-serif; color: #fff; }
        .ftc-mode { grid-column: 1 / -1; padding: 0.5rem 0.65rem; font-size: 0.66rem; line-height: 1.45; border-radius: 2px; }
        .ftc-mode.real-time { background: rgba(226, 140, 49, 0.1); border: 1px solid rgba(226, 140, 49, 0.35); color: #f3c98b; }
        .ftc-mode.delayed-mode { background: rgba(124, 224, 208, 0.08); border: 1px solid rgba(124, 224, 208, 0.3); color: #7ce0d0; }
        .ftc-empty { font-size: 0.75rem; line-height: 1.6; color: rgba(238, 250, 255, 0.6); padding: 0.4rem 0; }
        .ftc-error { padding: 0.6rem 0.7rem; background: rgba(226, 140, 49, 0.1); border: 1px solid rgba(226, 140, 49, 0.35); color: #e28c31; font-size: 0.72rem; line-height: 1.5; border-radius: 2px; }
        .ftc-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.4rem; }
        .ftc-steps li { display: flex; align-items: center; gap: 0.5rem; font-size: 0.7rem; color: rgba(238, 250, 255, 0.45); }
        .ftc-steps li.done, .ftc-steps li.active { color: rgba(238, 250, 255, 0.9); }
        .ftc-icon { flex: 0 0 auto; width: 12px; height: 12px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; }
        .ftc-steps li.done .ftc-icon { background: #7ce0d0; color: #01070e; } .ftc-steps li.done .ftc-icon::before { content: "✓"; }
        .ftc-steps li.active .ftc-icon { border: 2px solid rgba(120, 203, 233, 0.3); border-top-color: #7ce0d0; animation: ftSpin 0.8s linear infinite; }
        @keyframes ftSpin { to { transform: rotate(360deg); } }
        .ftc-result { display: grid; grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr); gap: 1.1rem; align-items: start; }
        .ftc-chart { width: 100%; height: auto; background: rgba(1, 7, 14, 0.35); border: 1px solid rgba(120, 203, 233, 0.08); border-radius: 2px; }
        .ftc-legend { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; margin-top: 0.4rem; }
        .ftc-legend span { display: flex; align-items: center; gap: 0.35rem; font-size: 0.55rem; letter-spacing: 0.05em; color: rgba(238, 250, 255, 0.65); }
        .ftc-legend .sw { display: inline-block; width: 12px; height: 2px; } .ftc-legend .sw.p { background: #7ce0d0; } .ftc-legend .sw.a { background: #e28c31; }
        .ftc-side { display: flex; flex-direction: column; gap: 0.8rem; }
        .ftc-depth { padding: 0.65rem 0.75rem; background: rgba(1, 7, 14, 0.35); border: 1px solid rgba(120, 203, 233, 0.12); border-radius: 2px; display: flex; flex-direction: column; gap: 0.45rem; }
        .ftc-depth-head { display: flex; justify-content: space-between; align-items: baseline; }
        .ftc-depth-head span { font-size: 0.55rem; letter-spacing: 0.08em; color: #78CBE9; } .ftc-depth-head strong { font: 600 0.95rem var(--font-space-grotesk), sans-serif; color: #fff; }
        .ftc-slider { width: 100%; accent-color: #7ce0d0; cursor: pointer; } .ftc-slider:disabled { opacity: 0.4; cursor: not-allowed; }
        .ftc-readout { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
        .ftc-readout span { display: block; font-size: 0.5rem; letter-spacing: 0.05em; color: #78CBE9; opacity: 0.75; margin-bottom: 0.1rem; }
        .ftc-readout strong { font: 600 0.85rem var(--font-space-grotesk), sans-serif; color: #fff; } .ftc-readout .p { color: #7ce0d0; } .ftc-readout .a { color: #e28c31; }
        .ftc-metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.7rem; }
        .ftc-metrics span { display: block; font-size: 0.55rem; letter-spacing: 0.06em; color: #78CBE9; opacity: 0.7; margin-bottom: 0.1rem; }
        .ftc-metrics strong { font: 600 1.05rem var(--font-space-grotesk), sans-serif; color: #fff; }
        .ftc-note { padding: 0.5rem 0.6rem; font-size: 0.64rem; line-height: 1.5; background: rgba(226, 140, 49, 0.08); border: 1px solid rgba(226, 140, 49, 0.3); border-radius: 2px; color: rgba(243, 201, 139, 0.92); }
        .ftc-caption { margin: 0; font-size: 0.62rem; line-height: 1.5; font-style: italic; color: rgba(238, 250, 255, 0.5); }
        @media (max-width: 900px) { .ftpanel-grid, .ftc-result { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
