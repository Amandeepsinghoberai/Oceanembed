'use client';

import { useState, useEffect } from 'react';

// The FastAPI live-prediction backend (backend/main.py). Defaults to local
// dev; set NEXT_PUBLIC_LIVE_API_BASE (e.g. in Vercel's project env vars) to
// point at the real deployed backend in production — same base URL pattern
// used everywhere else this project talks to it.
const LIVE_API_BASE = process.env.NEXT_PUBLIC_LIVE_API_BASE || 'http://localhost:8000';

// Reads /api/ocean-state/stream with fetch rather than EventSource, because
// EventSource can't see the HTTP status: a backend rate limit (429) looked
// identical to "backend is down". Calls onUpdate with each parsed SSE event
// and resolves once the stream ends. Throws Error with .rateLimited/.retryAfter
// set for a 429, or .httpStatus for any other non-OK response.
async function readOceanStateStream(lat, lon, signal, onUpdate) {
  const res = await fetch(`${LIVE_API_BASE}/api/ocean-state/stream?lat=${lat}&lon=${lon}`, { signal });
  if (res.status === 429) {
    const wait = parseInt(res.headers.get('Retry-After'), 10);
    const err = new Error('rate limited');
    err.rateLimited = true;
    err.retryAfter = Number.isFinite(wait) ? wait : null;
    throw err;
  }
  if (!res.ok || !res.body) {
    const err = new Error(`HTTP ${res.status}`);
    err.httpStatus = res.status;
    throw err;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let finished = false;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const messages = buffer.split('\n\n');
    buffer = messages.pop();
    for (const msg of messages) {
      if (!msg.startsWith('data: ')) continue; // ": keep-alive" comments
      const update = JSON.parse(msg.slice(6));
      if (update.step === 'error' || update.done) finished = true;
      onUpdate(update);
    }
  }
  if (!finished) throw new Error('stream ended early');
}

// The honest wording shown when the backend's per-IP rate limit kicks in.
export function rateLimitMessage(retryAfter) {
  return `You're making requests too quickly. Please wait${Number.isFinite(retryAfter) ? ` ${retryAfter} second${retryAfter === 1 ? '' : 's'}` : ' a moment'} before trying again.`;
}

function describeFailure(err) {
  if (err.rateLimited) return { error: rateLimitMessage(err.retryAfter), rateLimited: true };
  if (err.httpStatus) return { error: `The ocean-state service returned an error (HTTP ${err.httpStatus}).`, rateLimited: false };
  return { error: 'Could not reach the ocean-state service. Please check your connection and try again in a moment.', rateLimited: false };
}

// ---- Shared per-point store -------------------------------------------------
// Every Intelligence module used to start its own real /api/ocean-state/stream
// fetch on every mount, and the page mounts only the active tab - so switching
// tabs (or returning to one) re-fetched the same real data and burned the
// backend's per-IP rate limit. Now one fetch per point is started at most once
// and shared: a finished result is served instantly, and a fetch still in
// flight is joined rather than duplicated. Only WHEN a request fires changes;
// every value is still exactly what that request returned.
//
// - Keyed by the point rounded to 3 decimals (~100 m, far finer than the data grid).
// - Lives at module scope, so it survives tab switches (component unmounts).
// - A fetch is no longer aborted when a component unmounts: it finishes into
//   the store so the next visit is free instead of wasting the request.
// - Finished results expire after CACHE_TTL_MS so "live" data can't go stale.
// - Failures (incl. 429) are never kept: the entry is dropped so a later
//   visit retries instead of replaying an old error.
const CACHE_TTL_MS = 10 * 60 * 1000;
const store = new Map();

const pointKey = (lat, lon) => `${lat.toFixed(3)},${lon.toFixed(3)}`;

function notify(entry) {
  entry.subscribers.forEach((fn) => fn(entry));
}

function failEntry(entry, failure) {
  if (entry.status !== 'loading') return;
  entry.status = 'failed';
  entry.failure = failure;
  if (store.get(entry.key) === entry) store.delete(entry.key);
  notify(entry);
}

function startFetch(entry) {
  readOceanStateStream(entry.lat, entry.lon, undefined, (update) => {
    if (update.step === 'error') {
      failEntry(entry, { error: update.error || 'Live data fetch failed.', rateLimited: false });
    } else if (update.done) {
      entry.result = update.result;
      entry.status = 'done';
      entry.fetchedAt = Date.now();
      notify(entry);
    } else {
      entry.steps.push(update.step);
      notify(entry);
    }
  }).catch((err) => failEntry(entry, describeFailure(err)));
}

// Returns the shared entry for a point, starting the one real fetch only if
// there is no live entry (nothing yet, an expired result, or a dropped failure).
function acquireEntry(lat, lon) {
  const key = pointKey(lat, lon);
  let entry = store.get(key);
  if (entry && entry.status === 'done' && Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    store.delete(key);
    entry = undefined;
  }
  if (!entry) {
    entry = { key, lat, lon, status: 'loading', steps: [], result: null, failure: null, fetchedAt: 0, subscribers: new Set() };
    store.set(key, entry);
    startFetch(entry);
  }
  return entry;
}

const EMPTY_STATE = { steps: [], ocean: null, loadError: null, rateLimited: false, isLoading: false };

function snapshotOf(entry) {
  if (entry.status === 'done') return { steps: [...entry.steps], ocean: entry.result, loadError: null, rateLimited: false, isLoading: false };
  if (entry.status === 'failed') return { steps: [...entry.steps], ocean: null, loadError: entry.failure.error, rateLimited: entry.failure.rateLimited, isLoading: false };
  return { steps: [...entry.steps], ocean: null, loadError: null, rateLimited: false, isLoading: true };
}

// Imperative version — used by MaritimeModule, which fetches 2 points
// (origin + destination) inside one triggered action rather than reacting
// to a single lat/lon prop. Resolves once the shared fetch for that point
// finishes (immediately if it already has); calls onStep with each real
// step's label - replaying the ones that already landed if it joined a fetch
// in progress or a finished one - same progress-checklist data
// useOceanState() below gives the other 3 modules.
export function streamOceanState(lat, lon, onStep) {
  return new Promise((resolve) => {
    const entry = acquireEntry(lat, lon);
    let seen = 0;
    let settled = false;
    const sync = () => {
      while (seen < entry.steps.length) {
        const step = entry.steps[seen++];
        if (onStep) onStep(step);
      }
      if (settled) return;
      if (entry.status === 'done') {
        settled = true;
        entry.subscribers.delete(sync);
        resolve({ result: entry.result, error: null, rateLimited: false });
      } else if (entry.status === 'failed') {
        settled = true;
        entry.subscribers.delete(sync);
        resolve({ result: null, error: entry.failure.error, rateLimited: entry.failure.rateLimited });
      }
    };
    entry.subscribers.add(sync);
    sync();
  });
}

// Reactive hook — used by Fisheries, Ocean Health, and Offshore, each
// driven by a single selected lat/lon. Streams real per-step progress
// (SSE, /api/ocean-state/stream) instead of a single opaque fetch, so the
// UI can show the same kind of honest, real progress checklist the
// Solution page's live mode already shows — never a fabricated one, since
// every step text comes straight from a real fetch actually completing.
// rateLimited is true when the failure is the backend's 429 (not an outage).
export function useOceanState(lat, lon) {
  const [state, setState] = useState({ ...EMPTY_STATE, isLoading: true });

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setState(EMPTY_STATE);
      return;
    }
    const entry = acquireEntry(lat, lon);
    const apply = () => setState(snapshotOf(entry));
    apply();
    entry.subscribers.add(apply);
    return () => entry.subscribers.delete(apply);
  }, [lat, lon]);

  return state;
}
