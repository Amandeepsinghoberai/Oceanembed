'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import AnalysisPanel from './AnalysisPanel';
import RealOceanMap from './RealOceanMap';
import RecentSeasons from './RecentSeasons';
import { ModelResultsProvider } from '@/data/ModelResultsProvider';
import { parsePermalink, buildPermalinkUrl, classifyPermalinkRegion, sameSpot } from './permalink';

const DEFAULT_DEPTHS_M = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000];

export default function SolutionWorkspace() {
  const [depthIndex, setDepthIndex] = useState(0);
  const [isSurface, setIsSurface] = useState(true);
  // Default to id 0 — demo_1.json's point, per ModelResultsProvider's fixed load order.
  const [selectedId, setSelectedId] = useState(0);
  // A clicked point with no historical file — { lat, lon, region } — mutually
  // exclusive with selectedId (exactly one of the two is ever non-null).
  const [arbitraryPoint, setArbitraryPoint] = useState(null);
  const [locations, setLocations] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);

  // ---- Shareable permalink (?lat=&lon=&mode=&date=) ----
  // Parsed once, synchronously on the first client render - i.e. BEFORE any
  // child effect can write the default state over the URL.
  const initialLinkRef = useRef(undefined);
  if (initialLinkRef.current === undefined) {
    initialLinkRef.current = typeof window !== 'undefined' ? parsePermalink(window.location.search) : null;
  }
  // While a link is being restored, ignore the panel's interim reports (it
  // starts on the default point) so they can't overwrite the link's params.
  const restoreTargetRef = useRef(initialLinkRef.current ? { lat: initialLinkRef.current.lat, lon: initialLinkRef.current.lon, mode: initialLinkRef.current.mode || 'historical' } : null);
  const [restore, setRestore] = useState(null);
  const [linkNote, setLinkNote] = useState(null);
  const linkNoteRef = useRef(null);
  linkNoteRef.current = linkNote;

  useEffect(() => {
    const link = initialLinkRef.current;
    if (!link) return undefined;
    let cancelled = false;
    const giveUp = setTimeout(() => { restoreTargetRef.current = null; }, 25000);
    (async () => {
      await ModelResultsProvider.load();
      if (cancelled) return;
      const demo = ModelResultsProvider.getAllLocations().find((l) => sameSpot(l, link));
      if (demo) {
        const mode = link.mode || 'historical';
        restoreTargetRef.current = { lat: demo.lat, lon: demo.lon, mode };
        setSelectedId(demo.id);
        setArbitraryPoint(null);
        setRestore({ mode, lat: demo.lat, lon: demo.lon });
        if (mode === 'live') setLinkNote({ kind: 'live', sharedDate: link.date, lat: demo.lat, lon: demo.lon });
        else if (link.date && link.date !== demo.date) setLinkNote({ kind: 'date', sharedDate: link.date, savedDate: demo.date, lat: demo.lat, lon: demo.lon });
      } else {
        const region = classifyPermalinkRegion(link.lat, link.lon);
        if (!region) { restoreTargetRef.current = null; return; } // outside real model coverage - nothing to restore
        // A point with no saved historical result is live-only, whatever the link said.
        restoreTargetRef.current = { lat: link.lat, lon: link.lon, mode: 'live' };
        setSelectedId(null);
        setArbitraryPoint({ lat: link.lat, lon: link.lon, region });
        setRestore({ mode: 'live', lat: link.lat, lon: link.lon });
        setLinkNote({ kind: 'live', sharedDate: link.date, lat: link.lat, lon: link.lon });
      }
    })();
    return () => { cancelled = true; clearTimeout(giveUp); };
  }, []);

  // Keep the address bar in sync with whatever result is shown.
  const handleShareState = useCallback((s) => {
    if (typeof window === 'undefined') return;
    const target = restoreTargetRef.current;
    if (target) {
      if (sameSpot(s, target) && s.mode === target.mode) restoreTargetRef.current = null;
      else return;
    } else if (linkNoteRef.current && !(sameSpot(s, linkNoteRef.current) && (s.mode === 'live' || linkNoteRef.current.kind === 'date'))) {
      setLinkNote(null);
    }
    window.history.replaceState(window.history.state, '', buildPermalinkUrl(window.location.href, s));
  }, []);

  useEffect(() => {
    async function loadLocations() {
      await ModelResultsProvider.load();
      setLocations(ModelResultsProvider.getAllLocations());
    }
    loadLocations();
  }, []);

  useEffect(() => {
    async function loadSelected() {
      await ModelResultsProvider.load();
      setSelectedResult(ModelResultsProvider.getResultById(selectedId));
    }
    loadSelected();
  }, [selectedId]);

  // Real depth in metres for the map's decorative depth-tinted gradient —
  // derived from the selected point's own profile depths.
  const depthsM = selectedResult?.profile?.depths_m || DEFAULT_DEPTHS_M;
  const depthValueM = depthsM[Math.min(depthIndex, depthsM.length - 1)];

  return (
    <section className="solution-ws-root">

      <div className="ws-topbar">
        <h1 className="ws-heading">REGIONAL <span className="outline-text">CONDITIONS</span></h1>
      </div>

      <div className="ws-layout">
        <div className="ws-left">
          {linkNote && (
            <div className="permalink-note" role="status">
              <strong>SHARED LINK.</strong>{' '}
              {linkNote.kind === 'live'
                ? (linkNote.sharedDate
                    ? `This link was made from a live result dated ${linkNote.sharedDate}. Live results are fetched fresh, so this is a new live prediction and its values may differ.`
                    : 'This link was made from a live prediction. Live results are fetched fresh, so this is a new live prediction and its values may differ.')
                : `This link was made for ${linkNote.sharedDate}, but this point's saved historical result is dated ${linkNote.savedDate}. Showing the saved result.`}
              <button type="button" className="permalink-note-x" onClick={() => setLinkNote(null)} aria-label="Dismiss">×</button>
            </div>
          )}
          <AnalysisPanel
            depthIndex={depthIndex}
            setDepthIndex={setDepthIndex}
            isSurface={isSurface}
            setIsSurface={setIsSurface}
            selectedId={selectedId}
            arbitraryPoint={arbitraryPoint}
            restore={restore}
            onShareState={handleShareState}
          />
        </div>

        <div className="ws-right">
          <RealOceanMap
            depth={depthValueM}
            isSurface={isSurface}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            arbitraryPoint={arbitraryPoint}
            setArbitraryPoint={setArbitraryPoint}
            locations={locations}
          />
        </div>
      </div>

      {/* Additive: self-contained recent-seasons (NRT) time-lapse, own data, own state. */}
      <RecentSeasons />

      <style>{`
        .solution-ws-root {
          width: 100%;
          min-height: 100svh;
          /* just clears the 70px fixed nav (the page is already offset by the stat bar) */
          padding-top: 76px;
          padding-bottom: 2rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          color: #eefaff;
        }

        .ws-topbar {
          width: 100%;
          max-width: 1600px;
          padding: 0 clamp(1.5rem, 6vw, 6.5rem);
          margin-bottom: 1rem;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 0.25rem;
        }

        .ws-heading {
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: clamp(3rem, 4vw, 4rem);
          font-weight: 700;
          letter-spacing: -0.02em;
          line-height: 1.1;
          margin: 0;
          color: #fff;
        }

        .ws-heading .outline-text {
          color: transparent;
          -webkit-text-stroke: 1.5px rgba(255, 255, 255, 0.85);
        }

        .ws-layout {
          width: 100%;
          max-width: 1600px;
          padding: 0 clamp(1.5rem, 6vw, 6.5rem);
          display: flex;
          gap: 2rem;
          flex: 1;
          min-height: 0;
        }

        .permalink-note {
          position: relative;
          margin-bottom: 0.8rem;
          padding: 0.6rem 2rem 0.6rem 0.8rem;
          background: rgba(226, 140, 49, 0.1);
          border: 1px solid rgba(226, 140, 49, 0.4);
          border-radius: 2px;
          font-size: 0.72rem;
          line-height: 1.5;
          color: #f3c98b;
        }
        .permalink-note strong { color: #fff; letter-spacing: 0.06em; }
        .permalink-note-x { position: absolute; top: 0.3rem; right: 0.4rem; background: transparent; border: 0; color: #f3c98b; font-size: 1rem; line-height: 1; cursor: pointer; }
        .ws-left {
          flex: 0 0 38%;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .ws-right {
          flex: 0 0 calc(62% - 2rem);
          display: flex;
          flex-direction: column;
          min-height: 0;
          /* Don't stretch to match .ws-left's (often much taller) content
             height — let the map render at its own aspect-ratio-driven
             height instead of being force-stretched near-square. */
          align-self: flex-start;
        }

        @media (max-width: 1024px) {
          .ws-layout {
            flex-direction: column;
          }
          .ws-left, .ws-right {
            flex: inset;
            width: 100%;
          }
          .solution-ws-root {
            min-height: auto;
          }
        }
      `}</style>
    </section>
  );
}
