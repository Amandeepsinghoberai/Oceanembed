'use client';

import React, { useState } from "react";
import Link from "next/link";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import FisheriesModule from "@/components/intelligence/FisheriesModule";
import OceanHealthModule from "@/components/intelligence/OceanHealthModule";
import OffshoreModule from "@/components/intelligence/OffshoreModule";
import MaritimeModule from "@/components/intelligence/MaritimeModule";
import IntelligenceEngineFlow from "@/components/intelligence/IntelligenceEngineFlow";

export default function OceanIntelligencePage() {
  const [activeModule, setActiveModule] = useState<'fisheries' | 'ocean-health' | 'offshore' | 'maritime'>('fisheries');

  return (
    <div className="intel-page">
      <SiteNavbar />

      <main>
        {/* COMPACT PRODUCT WORKSPACE SECTION */}
        <section id="intelligence-modules" className="modules-section intel-width">
          {/* Header Row: Left-aligned Title + Right-aligned Compact Toggle */}
          <div className="header-row">
            <div className="compact-header">
              <div className="header-kicker">OCEANEMBED PLATFORM</div>
              <h1>OCEAN INTELLIGENCE</h1>
              <p>Turning ocean data into actionable intelligence.</p>
            </div>

            {/* Compact Right-Aligned Segmented Control */}
            <div className="segmented-control-wrapper">
              <div className="segmented-control" role="tablist" aria-label="Ocean Intelligence Domain Modules">
                <button
                  role="tab"
                  aria-selected={activeModule === 'fisheries'}
                  className={`segmented-btn ${activeModule === 'fisheries' ? 'active' : ''}`}
                  onClick={() => setActiveModule('fisheries')}
                >
                  Fisheries
                </button>

                <button
                  role="tab"
                  aria-selected={activeModule === 'ocean-health'}
                  className={`segmented-btn ${activeModule === 'ocean-health' ? 'active' : ''}`}
                  onClick={() => setActiveModule('ocean-health')}
                >
                  Ocean Health
                </button>

                <button
                  role="tab"
                  aria-selected={activeModule === 'offshore'}
                  className={`segmented-btn ${activeModule === 'offshore' ? 'active' : ''}`}
                  onClick={() => setActiveModule('offshore')}
                >
                  Offshore
                </button>

                <button
                  role="tab"
                  aria-selected={activeModule === 'maritime'}
                  className={`segmented-btn ${activeModule === 'maritime' ? 'active' : ''}`}
                  onClick={() => setActiveModule('maritime')}
                >
                  Maritime
                </button>
              </div>
            </div>
          </div>

          {/* Switchable Module Display */}
          <div className="module-view-wrapper key-fade">
            {activeModule === 'fisheries' && <FisheriesModule />}
            {activeModule === 'ocean-health' && <OceanHealthModule />}
            {activeModule === 'offshore' && <OffshoreModule />}
            {activeModule === 'maritime' && <MaritimeModule />}
          </div>
        </section>

        {/* SHARED ENGINE FLOW */}
        <IntelligenceEngineFlow />

        {/* CLOSING BANNER */}
        <section className="intel-close intel-width">
          <h2><span>TURNING OCEAN PHYSICS</span><em><span>INTO DECISION</span><span>SUPPORT.</span></em></h2>
          <p>
            OceanEmbed bridges the gap between complex subsurface oceanography and operational domain decisions.
          </p>
          <div className="close-links">
            <Link href="/solution">EXPLORE THE WORKSTATION <b>→</b></Link>
            <Link href="/technology">MODEL ARCHITECTURE <b>→</b></Link>
            <Link href="/data">ABOUT US <b>→</b></Link>
          </div>
        </section>
      </main>

      <Footer />

      <style>{`
        .intel-page {
          min-height: 100vh;
          background: linear-gradient(180deg, #78CBE9 0%, #3bb3cb 8%, #15799e 25%, #083c61 50%, #031124 75%, #01070e 100%);
          color: #eaf7ff;
          font-family: var(--font-public-sans), sans-serif;
        }
        .intel-page main {
          padding-top: 80px;
          overflow: hidden;
        }
        .intel-width {
          width: min(1240px, calc(100% - 3rem));
          margin: 0 auto;
        }
        .modules-section {
          padding-top: 1.2rem;
          padding-bottom: 3rem;
        }
        .header-row {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 2rem;
          margin-bottom: 2rem;
        }
        .compact-header {
          max-width: 580px;
        }
        .header-kicker {
          color: #7ce0d0;
          font: 600 0.65rem var(--font-public-sans), sans-serif;
          letter-spacing: 0.14em;
          margin-bottom: 0.3rem;
        }
        .compact-header h1 {
          color: #fff;
          font: 600 clamp(2rem, 3.2vw, 2.8rem) var(--font-space-grotesk), sans-serif;
          margin: 0 0 0.3rem 0;
          letter-spacing: -0.02em;
          line-height: 1;
          text-shadow: none;
        }
        .compact-header p {
          color: rgba(222, 244, 252, 0.75);
          font: 500 0.95rem var(--font-space-grotesk), sans-serif;
          margin: 0;
          text-shadow: none;
        }
        .segmented-control-wrapper {
          display: flex;
          justify-content: flex-end;
          align-items: center;
        }
        .segmented-control {
          display: inline-flex;
          background: rgba(1, 9, 21, 0.75);
          border: 1px solid rgba(120, 203, 233, 0.2);
          border-radius: 4px;
          padding: 0.25rem;
          gap: 0.2rem;
          backdrop-filter: blur(8px);
          width: fit-content;
        }
        .segmented-btn {
          background: transparent;
          border: 1px solid transparent;
          color: rgba(234, 247, 255, 0.75);
          font: 600 0.78rem var(--font-space-grotesk), sans-serif;
          letter-spacing: 0.04em;
          padding: 0.45rem 0.9rem;
          border-radius: 2px;
          cursor: pointer;
          white-space: nowrap;
          transition: all 0.2s ease;
        }
        .segmented-btn:hover {
          color: #fff;
          background: rgba(120, 203, 233, 0.1);
        }
        .segmented-btn.active {
          background: rgba(124, 224, 208, 0.15);
          border-color: rgba(124, 224, 208, 0.4);
          color: #7ce0d0;
          box-shadow: 0 0 12px rgba(124, 224, 208, 0.1);
        }
        .module-view-wrapper {
          animation: intelFadeIn 0.3s ease-out;
        }
        @keyframes intelFadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .intel-close {
          padding: 6rem 0 7rem;
        }
        .intel-close h2 {
          color: #fff;
          font: 600 clamp(2.8rem, 6.5vw, 5.5rem)/0.92 var(--font-space-grotesk), sans-serif;
          margin: 0;
        }
        .intel-close h2 span {
          display: block;
        }
        .intel-close h2 em span {
          color: transparent;
          -webkit-text-fill-color: transparent;
          -webkit-text-stroke: 1.5px #fff;
          font-style: normal;
        }
        .intel-close p {
          max-width: 570px;
          margin-top: 1.5rem;
          color: rgba(222, 244, 252, 0.7);
          line-height: 1.7;
          font-size: 0.98rem;
        }
        .close-links {
          display: flex;
          flex-wrap: wrap;
          gap: 2rem;
          margin-top: 2rem;
        }
        .close-links a {
          color: #7ce0d0;
          text-decoration: none;
          font: 600 0.75rem var(--font-public-sans), sans-serif;
          letter-spacing: 0.12em;
          border-bottom: 1px solid rgba(124, 224, 208, 0.4);
          padding-bottom: 0.5rem;
          transition: border-color 0.2s ease;
        }
        .close-links a:hover {
          border-color: #7ce0d0;
        }
        .close-links b {
          margin-left: 0.4rem;
        }
        @media (max-width: 900px) {
          .intel-page main {
            padding-top: 75px;
          }
          .header-row {
            flex-direction: column;
            align-items: flex-start;
            gap: 1.2rem;
          }
          .segmented-control-wrapper {
            justify-content: flex-start;
            width: 100%;
          }
          .segmented-control {
            overflow-x: auto;
            max-width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
