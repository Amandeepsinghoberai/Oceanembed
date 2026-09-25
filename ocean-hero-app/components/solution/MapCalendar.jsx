'use client';

import React, { useEffect, useRef, useState } from 'react';

// Map calendar — the "validate against real Argo floats, by date" feature that
// lives on the existing Solution map. RealOceanMap owns the toggle button and
// draws the real float markers; this module owns the data and the two panels:
//   useMapCalendar()      state + real fetches (dates, floats, comparison)
//   CalendarPopover       month calendar, opened over the map
//   CalendarComparison    predicted-vs-real-Argo chart for the clicked float
//
// Every value shown is real: real Argo index dates/positions, and a real model
// prediction from real satellite data for that exact date. When something
// can't be fetched it says so plainly.

const API_BASE = process.env.NEXT_PUBLIC_LIVE_API_BASE || 'http://localhost:8000';
const WINDOW_DAYS = 90;
const REGIONS = [
  { key: 'bay_of_bengal', label: 'Bay of Bengal' },
  { key: 'arabian_sea', label: 'Arabian Sea' },
];

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

// Hand-rolled, UTC-only, never toLocale* — this project has hit a
// server-vs-browser locale hydration mismatch before.
const pad = (n) => String(n).padStart(2, '0');
const toISO = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return toISO(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
}
function formatDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
  if (!m) return iso || '';
  return `${MONTH_ABBR[parseInt(m[2], 10) - 1]} ${parseInt(m[3], 10)}, ${m[1]}`;
}

const QUALITY_LABEL = {
  'real-time': 'Real-time Argo data (not our official quality-controlled validation set)',
  'delayed-mode': 'Delayed-mode (quality-controlled) Argo profile — but a single float, not our official aggregate validation numbers',
};

// Chart geometry (uniform-scaled SVG so text and dots stay undistorted).
const CH = { w: 300, h: 230, left: 44, right: 14, top: 14, bottom: 30, tMin: 5, tMax: 30, dMax: 1000 };
const chartX = (t) => CH.left + ((Math.min(Math.max(t, CH.tMin), CH.tMax) - CH.tMin) / (CH.tMax - CH.tMin)) * (CH.w - CH.left - CH.right);
const chartY = (d) => CH.top + (d / CH.dMax) * (CH.h - CH.top - CH.bottom);

// Runs of consecutive real values, so a depth the float never measured is
// drawn as a gap, not bridged with an invented line.
function segments(depths, temps) {
  const out = [];
  let run = [];
  temps.forEach((t, i) => {
    if (t === null || t === undefined) {
      if (run.length) out.push(run);
      run = [];
    } else {
      run.push([chartX(t), chartY(depths[i])]);
    }
  });
  if (run.length) out.push(run);
  return out;
}

// How deep a float's real profile reaches, in plain words (or null if unknown).
export function describeCoverage(cov) {
  if (!cov) return null;
  if (cov.depth_class === 'unusable') return 'profile with no quality-checked readings yet';
  if (cov.depth_class === 'full') return `full-depth profile (to ${Math.round(cov.max_dbar)} dbar)`;
  if (cov.depth_class === 'partial') return `limited profile, only to ${Math.round(cov.max_dbar)} dbar`;
  return cov.min_dbar > 100
    ? `limited profile, only ${Math.round(cov.min_dbar)}–${Math.round(cov.max_dbar)} dbar`
    : `shallow profile, only 0–${Math.round(cov.max_dbar)} dbar`;
}
export const isLimited = (f) => !!f.coverage && f.coverage.depth_class !== 'full';

export function useMapCalendar() {
  const [open, setOpen] = useState(false);
  const [today, setToday] = useState(null);
  const [viewMonth, setViewMonth] = useState(null); // { y, m }
  const [datesState, setDatesState] = useState({ loading: false, loaded: false, error: null, set: new Set() });
  const [selectedDate, setSelectedDate] = useState(null);
  const [floatsState, setFloatsState] = useState({ loading: false, error: null, floats: [] });
  const [covMap, setCovMap] = useState({});
  const [covLoading, setCovLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [cmp, setCmp] = useState({ loading: false, steps: [], result: null, error: null });
  const sourceRef = useRef(null);

  // "Today" only exists in the browser (avoids a server/client hydration mismatch).
  useEffect(() => {
    const now = new Date();
    setToday(toISO(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    setViewMonth({ y: now.getUTCFullYear(), m: now.getUTCMonth() });
  }, []);

  const windowStart = today ? addDays(today, -WINDOW_DAYS) : null;

  // Which real dates have Argo data (either region) — fetched the first time
  // the calendar is opened, never on plain page load.
  useEffect(() => {
    if (!open || !today || datesState.loaded) return;
    const controller = new AbortController();
    setDatesState((s) => ({ ...s, loading: true, error: null }));
    Promise.all(REGIONS.map((r) =>
      fetch(`${API_BASE}/api/argo-dates-with-data?region=${r.key}&start_date=${windowStart}&end_date=${today}`, { signal: controller.signal })
        .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
    ))
      .then((all) => setDatesState({ loading: false, loaded: true, error: null, set: new Set(all.flatMap((d) => d.dates)) }))
      .catch((e) => {
        if (e.name === 'AbortError') return;
        setDatesState({ loading: false, loaded: false, error: 'Could not load real Argo dates. Is the backend running?', set: new Set() });
      });
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, today]);

  // Real floats for the clicked date, from both regions.
  useEffect(() => {
    setSelectedFile(null);
    if (!selectedDate) {
      setFloatsState({ loading: false, error: null, floats: [] });
      return;
    }
    const controller = new AbortController();
    setFloatsState({ loading: true, error: null, floats: [] });
    Promise.all(REGIONS.map((r) =>
      fetch(`${API_BASE}/api/argo-floats-by-date?date=${selectedDate}&region=${r.key}`, { signal: controller.signal })
        .then((res) => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
        .then((data) => (data.floats || []).map((f) => ({ ...f, regionLabel: r.label })))
    ))
      .then((all) => setFloatsState({ loading: false, error: null, floats: all.flat() }))
      .catch((e) => {
        if (e.name === 'AbortError') return;
        setFloatsState({ loading: false, error: 'Could not load the real floats for this date.', floats: [] });
      });
    return () => controller.abort();
  }, [selectedDate]);

  // Real depth coverage of each float's profile, filled in after the floats
  // appear (each needs its own small download). Until it arrives a float is
  // shown normally - never assumed shallow or deep.
  useEffect(() => {
    if (!selectedDate || floatsState.loading || floatsState.floats.length === 0) { setCovLoading(false); return; }
    const controller = new AbortController();
    setCovLoading(true);
    Promise.all(REGIONS.map((r) =>
      fetch(`${API_BASE}/api/argo-profile-coverage?date=${selectedDate}&region=${r.key}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : { coverage: {} }))
        .then((d) => d.coverage || {})
    ))
      .then((all) => { setCovMap((m) => Object.assign({}, m, ...all)); setCovLoading(false); })
      .catch((e) => { if (e.name !== 'AbortError') setCovLoading(false); });
    return () => controller.abort();
  }, [selectedDate, floatsState.loading, floatsState.floats.length]);

  // Real predicted-vs-Argo comparison for the clicked float (streamed, so the
  // checklist reflects real fetches as they finish).
  useEffect(() => {
    sourceRef.current?.close();
    sourceRef.current = null;
    const fl = floatsState.floats.find((f) => f.file === selectedFile);
    if (!fl || !selectedDate) {
      setCmp({ loading: false, steps: [], result: null, error: null });
      return;
    }
    setCmp({ loading: true, steps: [], result: null, error: null });
    const source = new EventSource(`${API_BASE}/api/argo-date-comparison/stream?lat=${fl.lat}&lon=${fl.lon}&date=${selectedDate}`);
    sourceRef.current = source;
    source.onmessage = (event) => {
      const update = JSON.parse(event.data);
      if (update.step === 'error') {
        setCmp((c) => ({ ...c, loading: false, error: update.error || 'Comparison failed.' }));
        source.close();
      } else if (update.done) {
        setCmp((c) => ({ ...c, loading: false, result: update.result }));
        source.close();
      } else {
        setCmp((c) => ({ ...c, steps: [...c.steps, update.step] }));
      }
    };
    source.onerror = () => {
      setCmp((c) => ({ ...c, loading: false, error: 'Could not reach the comparison service. Is the backend running?' }));
      source.close();
    };
    return () => source.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFile]);

  useEffect(() => () => sourceRef.current?.close(), []);

  const toggle = () => {
    setOpen((o) => {
      if (o) setSelectedDate(null); // closing clears the date, its floats and any comparison
      return !o;
    });
  };
  const close = () => { setOpen(false); setSelectedDate(null); };
  const shiftMonth = (delta) => setViewMonth(({ y, m }) => {
    const t = new Date(Date.UTC(y, m + delta, 1));
    return { y: t.getUTCFullYear(), m: t.getUTCMonth() };
  });

  const mergedFloats = floatsState.floats.map((f) => ({ ...f, coverage: covMap[f.file] || f.coverage || null }));

  return {
    open, toggle, close, today, windowStart, viewMonth, shiftMonth,
    datesState, selectedDate, setSelectedDate,
    floatsState, floats: open ? mergedFloats : [], covLoading,
    selectedFile, setSelectedFile,
    selectedFloat: mergedFloats.find((f) => f.file === selectedFile) || null,
    cmp,
  };
}

const POPOVER_CSS = `
        .mc-popover { position: absolute; top: 1.5rem; left: 1.5rem; z-index: 12; width: 250px; max-height: calc(100% - 3rem); overflow-y: auto; display: flex; flex-direction: column; gap: 0.6rem; padding: 0.8rem 0.9rem; background: rgba(4, 21, 38, 0.93); border: 1px solid rgba(120, 203, 233, 0.25); backdrop-filter: blur(6px); border-radius: 3px; box-shadow: 0 4px 24px rgba(1, 7, 14, 0.6); color: #eefaff; }
        .mc-top { display: flex; justify-content: space-between; align-items: center; }
        .mc-kicker { font: 600 0.55rem var(--font-space-grotesk), sans-serif; letter-spacing: 0.1em; color: #7ce0d0; }
        .mc-close { width: 20px; height: 20px; background: transparent; border: 0; color: #78CBE9; font-size: 1.1rem; line-height: 1; cursor: pointer; }
        .mc-close:hover { color: #fff; }
        .mc-cal-head { display: flex; align-items: center; justify-content: space-between; }
        .mc-month { font: 600 0.85rem var(--font-space-grotesk), sans-serif; color: #fff; }
        .mc-nav { width: 24px; height: 24px; background: rgba(1, 7, 14, 0.6); border: 1px solid rgba(120, 203, 233, 0.2); color: #78CBE9; border-radius: 2px; cursor: pointer; font-size: 1rem; line-height: 1; }
        .mc-nav:disabled { opacity: 0.3; cursor: not-allowed; }
        .mc-weekdays, .mc-days { display: grid; grid-template-columns: repeat(7, 1fr); gap: 3px; }
        .mc-weekdays span { text-align: center; font-size: 0.55rem; letter-spacing: 0.08em; color: rgba(120, 203, 233, 0.55); }
        .mc-day { aspect-ratio: 1; padding: 0; border-radius: 3px; border: 1px solid transparent; background: transparent; color: rgba(238, 250, 255, 0.25); font: 500 0.7rem var(--font-space-grotesk), sans-serif; cursor: not-allowed; }
        .mc-day.has-data { background: rgba(226, 140, 49, 0.16); border-color: rgba(226, 140, 49, 0.55); color: #fff; cursor: pointer; transition: all 0.15s ease; }
        .mc-day.has-data:hover { background: rgba(226, 140, 49, 0.32); }
        .mc-day.selected { background: #e28c31; border-color: #f3c98b; color: #01070e; font-weight: 700; }
        .mc-foot { font-size: 0.62rem; line-height: 1.45; color: rgba(238, 250, 255, 0.72); }
        .mc-foot b { color: #f3c98b; }
        .mc-err { color: #e28c31; }
        .mc-legend { font-size: 0.58rem; line-height: 1.5; color: rgba(238, 250, 255, 0.7); }
        .mc-dot { display: inline-block; width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid #f3c98b; vertical-align: middle; margin: 0 0.25rem 0 0.1rem; }
        .mc-dot.full { background: rgba(226, 140, 49, 0.75); }
        .mc-dot.limited { background: transparent; border-style: dashed; }
        .mc-note { padding: 0.4rem 0.5rem; font-size: 0.57rem; line-height: 1.4; background: rgba(226, 140, 49, 0.09); border: 1px solid rgba(226, 140, 49, 0.3); border-radius: 2px; color: rgba(243, 201, 139, 0.9); }
        .mc-change { align-self: flex-start; padding: 0.3rem 0.6rem; background: rgba(120, 203, 233, 0.12); border: 1px solid rgba(120, 203, 233, 0.35); color: #eefaff; font: 600 0.55rem var(--font-space-grotesk), sans-serif; letter-spacing: 0.08em; border-radius: 2px; cursor: pointer; }
        .mc-change:hover { background: rgba(120, 203, 233, 0.25); }
`;

export function CalendarPopover({ cal }) {
  const { today, windowStart, viewMonth, datesState, selectedDate, floatsState } = cal;
  const nLimited = cal.floats.filter(isLimited).length;
  const nFull = cal.floats.filter((f) => f.coverage && f.coverage.depth_class === 'full').length;
  const summary = (
    <>
      <b>{floatsState.floats.length}</b> real profile{floatsState.floats.length === 1 ? '' : 's'}
      {cal.covLoading ? ' — checking how deep each one reaches…' : (nFull + nLimited > 0 ? ` — ${nFull} full-depth, ${nLimited} limited` : '')}
      {' '}— click a marker to compare.
    </>
  );
  const legend = nLimited > 0 && (
    <div className="mc-legend"><i className="mc-dot full" /> full-depth <i className="mc-dot limited" /> limited (shallow/partial): fewer depths to compare</div>
  );
  // Once a date is picked the calendar folds into a small pill so it never
  // hides the real floats it just placed on the map.
  const [expanded, setExpanded] = useState(true);

  const cells = [];
  let monthTitle = '';
  let canPrev = false;
  let canNext = false;
  if (viewMonth && today) {
    const { y, m } = viewMonth;
    monthTitle = `${MONTH_NAMES[m]} ${y}`;
    const firstWeekday = new Date(Date.UTC(y, m, 1)).getUTCDay();
    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const iso = toISO(y, m, d);
      const inWindow = iso >= windowStart && iso <= today;
      cells.push({ iso, d, inWindow, hasData: inWindow && datesState.set.has(iso) });
    }
    const prevLast = toISO(m === 0 ? y - 1 : y, m === 0 ? 11 : m - 1, new Date(Date.UTC(y, m, 0)).getUTCDate());
    const nextFirst = toISO(m === 11 ? y + 1 : y, m === 11 ? 0 : m + 1, 1);
    canPrev = prevLast >= windowStart;
    canNext = nextFirst <= today;
  }

  if (!expanded && selectedDate) {
    return (
      <div className="mc-popover mc-compact" role="dialog" aria-label="Selected Argo date">
        <div className="mc-top">
          <span className="mc-kicker">REAL ARGO FLOATS · {formatDate(selectedDate).toUpperCase()}</span>
          <button type="button" className="mc-close" onClick={cal.close} aria-label="Close calendar">×</button>
        </div>
        <div className="mc-foot">
          {floatsState.loading && <span>Loading real floats…</span>}
          {floatsState.error && <span className="mc-err">{floatsState.error}</span>}
          {!floatsState.loading && !floatsState.error && floatsState.floats.length === 0 && <span>No real Argo profile found in either region on this date.</span>}
          {floatsState.floats.length > 0 && <span>{summary}</span>}
        </div>
        {legend}
        <button type="button" className="mc-change" onClick={() => setExpanded(true)}>CHANGE DATE</button>
        <div className="mc-note">Mostly real-time (not quality-controlled) Argo data — a live spot-check, not our official validation.</div>
        <style>{POPOVER_CSS}</style>
      </div>
    );
  }

  return (
    <div className="mc-popover" role="dialog" aria-label="Real Argo float calendar">
      <div className="mc-top">
        <span className="mc-kicker">REAL ARGO FLOATS BY DATE</span>
        <button type="button" className="mc-close" onClick={cal.close} aria-label="Close calendar">×</button>
      </div>

      <div className="mc-cal-head">
        <button type="button" className="mc-nav" onClick={() => cal.shiftMonth(-1)} disabled={!canPrev} aria-label="Previous month">‹</button>
        <span className="mc-month">{monthTitle || '…'}</span>
        <button type="button" className="mc-nav" onClick={() => cal.shiftMonth(1)} disabled={!canNext} aria-label="Next month">›</button>
      </div>
      <div className="mc-weekdays">{WEEKDAYS.map((w, i) => <span key={i}>{w}</span>)}</div>
      <div className="mc-days">
        {cells.map((c, i) => c === null ? <span key={`e${i}`} /> : (
          <button
            type="button"
            key={c.iso}
            className={`mc-day ${c.hasData ? 'has-data' : ''} ${c.iso === selectedDate ? 'selected' : ''}`}
            disabled={!c.hasData}
            onClick={() => { cal.setSelectedDate(c.iso); setExpanded(false); }}
            title={c.hasData ? `Real Argo data on ${formatDate(c.iso)}` : (c.inWindow ? 'No real Argo float reported on this date' : `Outside the last ${WINDOW_DAYS} days`)}
          >
            {c.d}
          </button>
        ))}
      </div>

      <div className="mc-foot">
        {datesState.loading && <span>Loading real Argo dates…</span>}
        {datesState.error && <span className="mc-err">{datesState.error}</span>}
        {datesState.loaded && !selectedDate && (
          <span>{datesState.set.size} of the last {WINDOW_DAYS} days had real Argo data. Pick a highlighted day to see the floats on the map.</span>
        )}
        {selectedDate && floatsState.loading && <span>Loading real floats for {formatDate(selectedDate)}…</span>}
        {selectedDate && floatsState.error && <span className="mc-err">{floatsState.error}</span>}
        {selectedDate && !floatsState.loading && !floatsState.error && floatsState.floats.length === 0 && (
          <span>No real Argo profile found in either region on {formatDate(selectedDate)}.</span>
        )}
        {selectedDate && floatsState.floats.length > 0 && <span>{summary}</span>}
      </div>
      {legend}
      <div className="mc-note">Mostly real-time (not quality-controlled) Argo data — a live spot-check, not our official validation.</div>

      <style>{POPOVER_CSS}</style>
    </div>
  );
}

// Depth class derived from a finished comparison result, for when the separate
// coverage look-up hasn't landed yet. Same thresholds as the backend's.
function coverageFromResult(result) {
  const overlap = result.n_depths_overlap;
  const range = result.argo_measured_range_dbar;
  if (overlap === undefined || !range) return null;
  return { min_dbar: range[0], max_dbar: range[1], n_overlap: overlap, depth_class: overlap >= 14 ? 'full' : (overlap >= 8 ? 'partial' : 'shallow') };
}

export function CalendarComparison({ cal }) {
  const { selectedDate, cmp } = cal;
  const panelRef = useRef(null);
  const selectedRaw = cal.selectedFloat;
  // Only ever show a result that belongs to the float currently selected.
  const result = cmp.result && selectedRaw && cmp.result.float && cmp.result.float.file === selectedRaw.file ? cmp.result : null;
  const selectedFloat = selectedRaw && !selectedRaw.coverage && result ? { ...selectedRaw, coverage: coverageFromResult(result) } : selectedRaw;
  const [depthIdx, setDepthIdx] = useState(0);

  // The slider only spans depths the float genuinely measured, so it can
  // never land somewhere with nothing real to compare.
  const measured = result ? result.profile.argo_temp_c.map((v, i) => (v !== null && v !== undefined ? i : -1)).filter((i) => i >= 0) : [];
  const firstIdx = measured.length ? measured[0] : 0;
  const lastIdx = measured.length ? measured[measured.length - 1] : 0;
  useEffect(() => { if (result) setDepthIdx(firstIdx); }, [result]); // eslint-disable-line react-hooks/exhaustive-deps

  const nearestFull = (() => {
    if (!selectedFloat || !isLimited(selectedFloat)) return null;
    const dist = (f) => Math.hypot(f.lat - selectedFloat.lat, (f.lon - selectedFloat.lon) * Math.cos((selectedFloat.lat * Math.PI) / 180));
    return cal.floats.filter((f) => f.coverage && f.coverage.depth_class === 'full')
      .sort((a, b) => dist(a) - dist(b))[0] || null;
  })();

  useEffect(() => {
    panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedFloat?.file]);

  if (!selectedFloat) return null;

  const chartSegments = result ? {
    predicted: segments(result.profile.depths_m, result.profile.predicted_temp_c),
    argo: segments(result.profile.depths_m, result.profile.argo_temp_c),
  } : null;

  const sel = result ? {
    depth: result.profile.depths_m[depthIdx],
    predicted: result.profile.predicted_temp_c[depthIdx],
    argo: result.profile.argo_temp_c[depthIdx],
  } : null;

  return (
    <div className="cc-panel" ref={panelRef}>
      <div className="cc-label">MODEL VS. REAL ARGO FLOAT</div>

      <div className="cc-facts">
        <div><span>FLOAT</span><strong>{selectedFloat.float_id}</strong></div>
        <div><span>DATE</span><strong>{formatDate(selectedDate)} · {selectedFloat.time_utc} UTC</strong></div>
        <div><span>POSITION</span><strong>{selectedFloat.lat.toFixed(2)}°N · {selectedFloat.lon.toFixed(2)}°E</strong></div>
        <div><span>REGION</span><strong>{selectedFloat.regionLabel}</strong></div>
        <div className={`cc-mode ${selectedFloat.data_mode}`}>{QUALITY_LABEL[selectedFloat.data_mode]}</div>
      </div>

      {isLimited(selectedFloat) && (
        <div className="cc-limited">
          <strong>LIMITED PROFILE</strong> — on this date this float only measured {selectedFloat.coverage.max_dbar === null ? 'no quality-checked depths' : `${Math.round(selectedFloat.coverage.min_dbar)}–${Math.round(selectedFloat.coverage.max_dbar)} dbar`}, so
          {selectedFloat.coverage.n_overlap > 0 ? ` only ${selectedFloat.coverage.n_overlap} of the model's 15 depths can be compared` : " none of the model's 15 depths can be compared"}.
          {nearestFull
            ? <button type="button" className="cc-switch" onClick={() => cal.setSelectedFile(nearestFull.file)}>COMPARE THE NEAREST FULL-DEPTH FLOAT ({nearestFull.float_id})</button>
            : (cal.covLoading ? ' Checking the other floats on this date…' : ' No full-depth float reported on this date.')}
        </div>
      )}

      {cmp.loading && (
        <ul className="cc-steps">
          {cmp.steps.map((s, i) => (
            <li key={i} className={i === cmp.steps.length - 1 ? 'active' : 'done'}>
              <span className="cc-step-icon" />{s}
            </li>
          ))}
        </ul>
      )}

      {cmp.error && <div className="cc-error">COMPARISON UNAVAILABLE — {cmp.error}</div>}

      {result && chartSegments && (
        <div className="cc-result">
          <div className="cc-chart-col">
            <svg viewBox={`0 0 ${CH.w} ${CH.h}`} className="cc-chart" role="img" aria-label="Predicted versus Argo temperature by depth">
              {[0, 250, 500, 750, 1000].map((d) => (
                <g key={d}>
                  <line x1={CH.left} x2={CH.w - CH.right} y1={chartY(d)} y2={chartY(d)} stroke="#15799e" strokeWidth="0.5" opacity="0.35" />
                  <text x={CH.left - 5} y={chartY(d) + 3} textAnchor="end" fontSize="8" fill="rgba(238,250,255,0.6)">{d}m</text>
                </g>
              ))}
              {[5, 10, 15, 20, 25, 30].map((t) => (
                <g key={t}>
                  <line x1={chartX(t)} x2={chartX(t)} y1={CH.top} y2={CH.h - CH.bottom} stroke="#15799e" strokeWidth="0.5" opacity="0.2" />
                  <text x={chartX(t)} y={CH.h - CH.bottom + 12} textAnchor="middle" fontSize="8" fill="rgba(238,250,255,0.6)">{t}°</text>
                </g>
              ))}
              {chartSegments.predicted.map((seg, i) => (
                <polyline key={`p${i}`} points={seg.map((p) => p.join(',')).join(' ')} fill="none" stroke="#7ce0d0" strokeWidth="1.8" />
              ))}
              {sel && (
                <g>
                  <line x1={CH.left} x2={CH.w - CH.right} y1={chartY(sel.depth)} y2={chartY(sel.depth)} stroke="#eefaff" strokeWidth="0.8" strokeDasharray="2 2" opacity="0.7" />
                  {sel.predicted !== null && sel.predicted !== undefined && <circle cx={chartX(sel.predicted)} cy={chartY(sel.depth)} r="4.5" fill="none" stroke="#7ce0d0" strokeWidth="1.6" />}
                  {sel.argo !== null && sel.argo !== undefined && <circle cx={chartX(sel.argo)} cy={chartY(sel.depth)} r="4.5" fill="none" stroke="#e28c31" strokeWidth="1.6" />}
                </g>
              )}
              {chartSegments.argo.map((seg, i) => (
                <g key={`a${i}`}>
                  <polyline points={seg.map((p) => p.join(',')).join(' ')} fill="none" stroke="#e28c31" strokeWidth="1.5" strokeDasharray="4 3" />
                  {seg.map((p, j) => <circle key={j} cx={p[0]} cy={p[1]} r="2" fill="#e28c31" />)}
                </g>
              ))}
            </svg>
            <div className="cc-legend">
              <span><i className="sw predicted" /> OCEANEMBED PREDICTION</span>
              <span><i className="sw argo" /> REAL ARGO FLOAT</span>
            </div>
          </div>

          <div className="cc-side">
            <div className="cc-depth">
              <div className="cc-depth-head">
                <span>DEPTH</span>
                <strong>{sel.depth} m</strong>
              </div>
              <input
                type="range" min={firstIdx} max={lastIdx} step="1"
                value={Math.min(Math.max(depthIdx, firstIdx), lastIdx)} onChange={(e) => setDepthIdx(Number(e.target.value))}
                disabled={firstIdx === lastIdx}
                className="cc-slider" aria-label="Depth to inspect"
              />
              <div className="cc-depth-ticks"><span>{result.profile.depths_m[firstIdx]} m</span><span>{result.profile.depths_m[lastIdx]} m</span></div>
              <div className="cc-readout">
                <div><span>OCEANEMBED PREDICTION</span><strong className="pred">{sel.predicted === null || sel.predicted === undefined ? '—' : `${sel.predicted.toFixed(2)}°C`}</strong></div>
                <div><span>REAL ARGO FLOAT</span><strong className="argo">{sel.argo === null || sel.argo === undefined ? 'not measured' : `${sel.argo.toFixed(2)}°C`}</strong></div>
                <div><span>DIFFERENCE</span><strong>{sel.argo === null || sel.argo === undefined || sel.predicted === null || sel.predicted === undefined ? '—' : `${(sel.predicted - sel.argo >= 0 ? '+' : '')}${(sel.predicted - sel.argo).toFixed(2)}°C`}</strong></div>
              </div>
              {(sel.argo === null || sel.argo === undefined) && (
                <div className="cc-nodata">This float did not measure at {sel.depth} m{result.argo_measured_range_dbar ? ` (it reported ${result.argo_measured_range_dbar[0]}–${result.argo_measured_range_dbar[1]} dbar)` : ''}, so there is nothing real to compare here.</div>
              )}
            </div>

            {result.metrics ? (
              <div className="cc-metrics">
                <div><span>RMSE</span><strong>{result.metrics.rmse_c.toFixed(2)}°C</strong></div>
                <div><span>BIAS</span><strong>{result.metrics.bias_c.toFixed(2)}°C</strong></div>
                <div><span>CORRELATION</span><strong>{result.metrics.correlation === null ? '—' : result.metrics.correlation.toFixed(3)}</strong></div>
                <div><span>DEPTHS COMPARED</span><strong>{result.metrics.n_depths} / 15</strong></div>
                {result.metrics.n_depths < 15 && result.argo_measured_range_dbar && (
                  <div className="cc-metric-note">Computed only over the depths this float measured ({Math.round(result.argo_measured_range_dbar[0])}–{Math.round(result.argo_measured_range_dbar[1])} dbar).</div>
                )}
              </div>
            ) : (
              <div className="cc-nodata">
                Too few real measurements for summary metrics: only {result.n_depths_overlap ?? 'a few'} of the model&apos;s 15 depths overlap with what this float measured
                {result.argo_measured_range_dbar ? ` (it reported ${result.argo_measured_range_dbar[0]}–${result.argo_measured_range_dbar[1]} dbar)` : ''}.
                An RMSE from so few points would be misleading, so none is shown.
              </div>
            )}
            <p className="cc-caption">
              Computed from this one float profile at the depths it actually measured — a spot-check, not our official validation numbers.
              Blank stretches of the dashed line are depths the float did not measure. Model inputs are real satellite data for {formatDate(result.date)}.
            </p>
          </div>
        </div>
      )}

      <style>{`
        .cc-panel { margin-top: 1rem; padding: 1.1rem 1.2rem; display: flex; flex-direction: column; gap: 0.8rem; background: rgba(4, 21, 38, 0.55); border: 1px solid rgba(120, 203, 233, 0.15); backdrop-filter: blur(10px); border-radius: 4px; color: #eefaff; }
        .cc-label { font-size: 0.68rem; letter-spacing: 0.1em; color: #78CBE9; font-weight: 500; opacity: 0.85; }
        .cc-facts { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 0.6rem 1rem; }
        .cc-facts > div span { display: block; font-size: 0.58rem; letter-spacing: 0.08em; color: #78CBE9; opacity: 0.7; margin-bottom: 0.15rem; }
        .cc-facts > div strong { font: 500 0.82rem var(--font-space-grotesk), sans-serif; color: #fff; }
        .cc-mode { grid-column: 1 / -1; padding: 0.5rem 0.65rem; font-size: 0.68rem; line-height: 1.45; border-radius: 2px; }
        .cc-mode.real-time { background: rgba(226, 140, 49, 0.1); border: 1px solid rgba(226, 140, 49, 0.35); color: #f3c98b; }
        .cc-mode.delayed-mode { background: rgba(124, 224, 208, 0.08); border: 1px solid rgba(124, 224, 208, 0.3); color: #7ce0d0; }
        .cc-steps { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.45rem; }
        .cc-steps li { display: flex; align-items: center; gap: 0.55rem; font-size: 0.72rem; color: rgba(238, 250, 255, 0.45); }
        .cc-steps li.done, .cc-steps li.active { color: rgba(238, 250, 255, 0.9); }
        .cc-step-icon { flex: 0 0 auto; width: 12px; height: 12px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.6rem; line-height: 1; }
        .cc-steps li.done .cc-step-icon { background: #7ce0d0; color: #01070e; }
        .cc-steps li.done .cc-step-icon::before { content: "✓"; }
        .cc-steps li.active .cc-step-icon { border: 2px solid rgba(120, 203, 233, 0.3); border-top-color: #7ce0d0; animation: ccSpin 0.8s linear infinite; }
        @keyframes ccSpin { to { transform: rotate(360deg); } }
        .cc-error { padding: 0.6rem 0.7rem; background: rgba(226, 140, 49, 0.1); border: 1px solid rgba(226, 140, 49, 0.35); color: #e28c31; font-size: 0.74rem; line-height: 1.5; border-radius: 2px; }
        .cc-result { display: grid; grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr); gap: 1.4rem; align-items: start; }
        .cc-chart { width: 100%; height: auto; background: rgba(1, 7, 14, 0.35); border: 1px solid rgba(120, 203, 233, 0.08); border-radius: 2px; }
        .cc-legend { display: flex; gap: 1.2rem; flex-wrap: wrap; margin-top: 0.5rem; }
        .cc-legend span { display: flex; align-items: center; gap: 0.35rem; font-size: 0.6rem; letter-spacing: 0.05em; color: rgba(238, 250, 255, 0.65); }
        .sw { display: inline-block; width: 12px; height: 2px; border-radius: 1px; }
        .sw.predicted { background: #7ce0d0; }
        .sw.argo { background: #e28c31; }
        .cc-side { display: flex; flex-direction: column; gap: 0.9rem; }
        .cc-depth { padding: 0.7rem 0.8rem; background: rgba(1, 7, 14, 0.35); border: 1px solid rgba(120, 203, 233, 0.12); border-radius: 2px; display: flex; flex-direction: column; gap: 0.5rem; }
        .cc-depth-head { display: flex; justify-content: space-between; align-items: baseline; }
        .cc-depth-head span { font-size: 0.58rem; letter-spacing: 0.08em; color: #78CBE9; opacity: 0.8; }
        .cc-depth-head strong { font: 600 1rem var(--font-space-grotesk), sans-serif; color: #fff; }
        .cc-slider { width: 100%; accent-color: #7ce0d0; cursor: pointer; }
        .cc-depth-ticks { display: flex; justify-content: space-between; font-size: 0.55rem; color: rgba(238, 250, 255, 0.5); }
        .cc-readout { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
        .cc-readout span { display: block; font-size: 0.5rem; letter-spacing: 0.05em; color: #78CBE9; opacity: 0.75; margin-bottom: 0.15rem; }
        .cc-readout strong { font: 600 0.9rem var(--font-space-grotesk), sans-serif; color: #fff; }
        .cc-readout strong.pred { color: #7ce0d0; }
        .cc-readout strong.argo { color: #e28c31; }
        .cc-limited { padding: 0.6rem 0.75rem; font-size: 0.72rem; line-height: 1.55; background: rgba(226, 140, 49, 0.1); border: 1px solid rgba(226, 140, 49, 0.4); border-radius: 2px; color: #f3c98b; }
        .cc-limited strong { color: #fff; letter-spacing: 0.06em; }
        .cc-switch { margin-top: 0.4rem; display: block; padding: 0.4rem 0.7rem; background: rgba(124, 224, 208, 0.12); border: 1px solid #7ce0d0; color: #eefaff; font: 600 0.6rem var(--font-space-grotesk), sans-serif; letter-spacing: 0.06em; border-radius: 2px; cursor: pointer; }
        .cc-switch:hover { background: rgba(124, 224, 208, 0.25); }
        .cc-metric-note { grid-column: 1 / -1; font-size: 0.6rem; color: rgba(238, 250, 255, 0.55); }
        .cc-slider:disabled { opacity: 0.4; cursor: not-allowed; }
        .cc-nodata { padding: 0.5rem 0.6rem; font-size: 0.66rem; line-height: 1.5; background: rgba(226, 140, 49, 0.08); border: 1px solid rgba(226, 140, 49, 0.3); border-radius: 2px; color: rgba(243, 201, 139, 0.92); }
        .cc-metrics { display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.8rem; }
        .cc-metrics span { display: block; font-size: 0.55rem; letter-spacing: 0.06em; color: #78CBE9; opacity: 0.7; margin-bottom: 0.15rem; }
        .cc-metrics strong { font: 600 1.1rem var(--font-space-grotesk), sans-serif; color: #fff; }
        .cc-caption { margin: 0; font-size: 0.66rem; line-height: 1.5; font-style: italic; color: rgba(238, 250, 255, 0.5); }
        @media (max-width: 760px) { .cc-facts { grid-template-columns: 1fr 1fr; } .cc-result { grid-template-columns: 1fr; } }
      `}</style>
    </div>
  );
}
