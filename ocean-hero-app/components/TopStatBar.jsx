"use client";

import React, { useEffect, useRef, useState } from "react";
import { REGION_SUMMARY, TOTAL_ARGO_VALIDATED, formatCount } from "@/lib/modelStats";

// A slim, fixed strip above every page (added once in the root layout) so a
// first-time visitor sees the model's real accuracy numbers and whether the
// backend is actually live within seconds - no scrolling required. Lives
// outside OceanHero on purpose: OceanHero's scroll-jacked track starts
// immediately under <main> with nothing above it, so this never touches it.

const API_BASE = process.env.NEXT_PUBLIC_LIVE_API_BASE || "http://localhost:8000";
const CHECK_INTERVAL_MS = 45000;
const REQUEST_TIMEOUT_MS = 8000; // longer than a normal response, short of a full cold-start wait

function useBackendStatus() {
  const [status, setStatus] = useState("checking"); // 'checking' | 'live' | 'waking' | 'offline'
  const wakingTimerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const controller = new AbortController();
      // If it hasn't answered by REQUEST_TIMEOUT_MS, assume a Render free-tier
      // cold start and say so, rather than just sitting on "checking".
      wakingTimerRef.current = setTimeout(() => {
        if (!cancelled) setStatus((s) => (s === "live" ? s : "waking"));
      }, REQUEST_TIMEOUT_MS);

      try {
        const res = await fetch(`${API_BASE}/api/health`, { signal: controller.signal });
        clearTimeout(wakingTimerRef.current);
        if (!cancelled) setStatus(res.ok ? "live" : "offline");
      } catch {
        clearTimeout(wakingTimerRef.current);
        if (!cancelled) setStatus("offline");
      }
    };

    check();
    const interval = setInterval(check, CHECK_INTERVAL_MS);
    return () => { cancelled = true; clearInterval(interval); clearTimeout(wakingTimerRef.current); };
  }, []);

  return status;
}

const STATUS_LABEL = { checking: "Checking...", live: "Live", waking: "Waking up...", offline: "Offline" };

export default function TopStatBar() {
  const status = useBackendStatus();
  const bay = REGION_SUMMARY["BAY OF BENGAL"];
  const arabian = REGION_SUMMARY["ARABIAN SEA"];
  const rootRef = useRef(null);

  // The existing SiteNavbar (other pages) and OceanHero's own baked-in nav
  // (homepage) are both `position: fixed; top: 0`. Rather than hardcode a
  // pixel height two other files would need to stay in sync with, measure
  // this strip's real rendered height and publish it as a CSS variable those
  // two navs read to offset themselves down by exactly that amount.
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const publish = () => document.documentElement.style.setProperty("--tsb-height", `${el.offsetHeight}px`);
    publish();
    const ro = new ResizeObserver(publish);
    ro.observe(el);
    return () => { ro.disconnect(); document.documentElement.style.removeProperty("--tsb-height"); };
  }, []);

  return (
    <div className="tsb-root" ref={rootRef} role="complementary" aria-label="Live model status and validation numbers">
      <div className="tsb-inner">
        <div className="tsb-stats">
          <div className="tsb-stat">
            <span className="tsb-val">{bay.rmse.toFixed(3)}°C</span>
            <span className="tsb-lbl">Bay of Bengal RMSE</span>
          </div>
          <div className="tsb-stat">
            <span className="tsb-val">{arabian.rmse.toFixed(3)}°C</span>
            <span className="tsb-lbl">Arabian Sea RMSE</span>
          </div>
          <div className="tsb-stat">
            <span className="tsb-val">{(TOTAL_ARGO_VALIDATED / 1_000_000).toFixed(1)}M+</span>
            <span className="tsb-lbl" title={`${formatCount(TOTAL_ARGO_VALIDATED)} real Argo measurements`}>Argo measurements validated</span>
          </div>
        </div>

        <div className={`tsb-status tsb-status-${status}`}>
          <i className="tsb-dot" />
          {STATUS_LABEL[status]}
        </div>
      </div>

      <style>{`
        .tsb-root {
          position: fixed;
          top: 0; left: 0; right: 0;
          z-index: 999999;
          background: rgba(1, 7, 14, 0.82);
          backdrop-filter: blur(6px);
          border-bottom: 1px solid rgba(120, 203, 233, 0.15);
          color: #eefaff;
          font-family: var(--font-public-sans), sans-serif;
        }
        .tsb-inner {
          max-width: 1600px;
          margin: 0 auto;
          padding: 0.45rem clamp(1rem, 4vw, 4rem);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }
        .tsb-stats { display: flex; gap: clamp(1rem, 3vw, 2.2rem); flex-wrap: wrap; }
        .tsb-stat { display: flex; align-items: baseline; gap: 0.4rem; white-space: nowrap; }
        .tsb-val { font: 700 0.85rem var(--font-space-grotesk), sans-serif; color: #7ce0d0; }
        .tsb-lbl { font-size: 0.62rem; letter-spacing: 0.02em; color: rgba(238, 250, 255, 0.65); }
        .tsb-status {
          display: flex; align-items: center; gap: 0.4rem;
          font: 600 0.65rem var(--font-space-grotesk), sans-serif;
          letter-spacing: 0.05em;
          white-space: nowrap;
        }
        .tsb-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; }
        .tsb-status-checking { color: rgba(238, 250, 255, 0.5); }
        .tsb-status-live { color: #5ee6a3; }
        .tsb-status-live .tsb-dot { box-shadow: 0 0 6px #5ee6a3; }
        .tsb-status-waking { color: #f3c98b; }
        .tsb-status-waking .tsb-dot { animation: tsbPulse 1s ease-in-out infinite; }
        .tsb-status-offline { color: #e2685c; }
        @keyframes tsbPulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

        @media (max-width: 640px) {
          .tsb-inner { padding: 0.4rem 1rem; }
          .tsb-stats { gap: 0.8rem; }
          .tsb-lbl { display: none; }
        }
      `}</style>
    </div>
  );
}
