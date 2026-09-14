'use client';

import { useState, useEffect, useRef } from 'react';

// The FastAPI live-prediction backend (backend/main.py) — same base URL
// pattern used everywhere else this project talks to it.
const LIVE_API_BASE = 'http://localhost:8000';

// Imperative version — used by MaritimeModule, which fetches 2 points
// (origin + destination) inside one triggered action rather than reacting
// to a single lat/lon prop. Resolves once the stream reports done; calls
// onStep with each real step's label as it lands, same progress-checklist
// data useOceanState() below gives the other 3 modules.
export function streamOceanState(lat, lon, onStep) {
  return new Promise((resolve) => {
    const source = new EventSource(`${LIVE_API_BASE}/api/ocean-state/stream?lat=${lat}&lon=${lon}`);
    source.onmessage = (event) => {
      const update = JSON.parse(event.data);
      if (update.step === 'error') {
        source.close();
        resolve({ result: null, error: update.error || 'Live data fetch failed.' });
      } else if (update.done) {
        source.close();
        resolve({ result: update.result, error: null });
      } else if (onStep) {
        onStep(update.step);
      }
    };
    source.onerror = () => {
      source.close();
      resolve({ result: null, error: 'Could not reach the ocean-state service. Is the backend running on localhost:8000?' });
    };
  });
}

// Reactive hook — used by Fisheries, Ocean Health, and Offshore, each
// driven by a single selected lat/lon. Streams real per-step progress
// (SSE, /api/ocean-state/stream) instead of a single opaque fetch, so the
// UI can show the same kind of honest, real progress checklist the
// Solution page's live mode already shows — never a fabricated one, since
// every step text comes straight from a real fetch actually completing.
export function useOceanState(lat, lon) {
  const [steps, setSteps] = useState([]);
  const [ocean, setOcean] = useState(null);
  const [loadError, setLoadError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const sourceRef = useRef(null);

  useEffect(() => {
    sourceRef.current?.close();
    setSteps([]);
    setOcean(null);
    setLoadError(null);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const source = new EventSource(`${LIVE_API_BASE}/api/ocean-state/stream?lat=${lat}&lon=${lon}`);
    sourceRef.current = source;

    source.onmessage = (event) => {
      const update = JSON.parse(event.data);
      if (update.step === 'error') {
        setLoadError(update.error || 'Live data fetch failed.');
        setIsLoading(false);
        source.close();
      } else if (update.done) {
        setOcean(update.result);
        setIsLoading(false);
        source.close();
      } else {
        setSteps((prev) => [...prev, update.step]);
      }
    };

    source.onerror = () => {
      setLoadError('Could not reach the ocean-state service. Is the backend running on localhost:8000?');
      setIsLoading(false);
      source.close();
    };

    return () => source.close();
  }, [lat, lon]);

  return { steps, ocean, loadError, isLoading };
}
