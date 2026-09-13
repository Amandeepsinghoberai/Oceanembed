'use client';

import React from 'react';

export default function IntelligenceEngineFlow() {
  return (
    <section className="engine-flow-section">
      <div className="flow-container">
        <div className="section-header">
          <span className="section-tag">SHARED ARCHITECTURE</span>
          <h2>SHARED OCEAN INTELLIGENCE ENGINE</h2>
          <p className="section-desc">
            A single, continuous oceanographic model powering domain-specific decision support systems.
          </p>
        </div>

        <div className="flow-diagram">
          {/* Node 1: Ocean Data */}
          <div className="flow-node node-input">
            <span className="node-step">01 — DATA INGEST</span>
            <h3>OCEAN DATA</h3>
            <p>Satellite SST / SSS / SLA • GLORYS Reanalysis • Argo Floats</p>
          </div>

          <div className="flow-connector">
            <span className="arrow-line"></span>
            <span className="arrow-head">↓</span>
          </div>

          {/* Node 2: OceanEmbed Engine */}
          <div className="flow-node node-core">
            <span className="node-step">02 — COMPUTATIONAL ENGINE</span>
            <h3>OCEANEMBED</h3>
            <p>Deep Learning Subsurface Temperature &amp; Profile Reconstruction</p>
          </div>

          <div className="flow-connector">
            <span className="arrow-line"></span>
            <span className="arrow-head">↓</span>
          </div>

          {/* Node 3: Reconstructed State */}
          <div className="flow-node node-state">
            <span className="node-step">03 — RECONSTRUCTED STATE</span>
            <h3>RECONSTRUCTED OCEAN STATE</h3>
            <div className="state-pills">
              <span>Temperature T(z)</span>
              <span>Salinity S(z)</span>
              <span>Current Vectors (u,v)</span>
              <span>Subsurface Anomalies</span>
            </div>
          </div>

          <div className="flow-connector">
            <span className="arrow-line"></span>
            <span className="arrow-head">↓</span>
          </div>

          {/* Node 4: Intelligence Layer */}
          <div className="flow-node node-intel">
            <span className="node-step">04 — DOMAIN TRANSLATION</span>
            <h3>OCEAN INTELLIGENCE</h3>
            <p>Domain-Specific Criteria &amp; Environmental Decision Rules</p>
          </div>

          <div className="flow-connector">
            <span className="arrow-line"></span>
            <span className="arrow-head">↓</span>
          </div>

          {/* Node 5: 4 Domain Outputs Grid */}
          <div className="domain-output-grid">
            <div className="domain-box">
              <span className="d-num">01</span>
              <h4>FISHERIES</h4>
              <p className="d-sub">Environmental Fishing Suitability Zones</p>
            </div>

            <div className="domain-box">
              <span className="d-num">02</span>
              <h4>ENVIRONMENT</h4>
              <p className="d-sub">Subsurface Anomaly &amp; Health Monitoring</p>
            </div>

            <div className="domain-box">
              <span className="d-num">03</span>
              <h4>OFFSHORE</h4>
              <p className="d-sub">Offshore Asset Site Condition Intelligence</p>
            </div>

            <div className="domain-box">
              <span className="d-num">04</span>
              <h4>MARITIME</h4>
              <p className="d-sub">Current-Aware Route Decision Support</p>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .engine-flow-section {
          padding: 6rem 0;
          border-top: 1px solid rgba(120, 203, 233, 0.15);
          border-bottom: 1px solid rgba(120, 203, 233, 0.15);
          background: rgba(1, 9, 21, 0.4);
          margin: 4rem 0;
        }
        .flow-container {
          width: min(1240px, calc(100% - 3rem));
          margin: 0 auto;
        }
        .section-header {
          text-align: center;
          max-width: 750px;
          margin: 0 auto 4rem auto;
        }
        .section-tag {
          color: #7ce0d0;
          font: 600 0.7rem var(--font-public-sans), sans-serif;
          letter-spacing: 0.14em;
          display: block;
          margin-bottom: 0.5rem;
        }
        .section-header h2 {
          color: #fff;
          font: 600 clamp(2rem, 3.5vw, 3rem) var(--font-space-grotesk), sans-serif;
          margin: 0 0 1rem 0;
          letter-spacing: -0.01em;
        }
        .section-desc {
          color: rgba(222, 244, 252, 0.7);
          font-size: 1rem;
          line-height: 1.6;
          margin: 0;
        }
        .flow-diagram {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.8rem;
          max-width: 900px;
          margin: 0 auto;
        }
        .flow-node {
          width: 100%;
          padding: 1.5rem 2rem;
          border-radius: 4px;
          border: 1px solid rgba(120, 203, 233, 0.2);
          background: rgba(3, 17, 36, 0.8);
          text-align: center;
          backdrop-filter: blur(4px);
          transition: all 0.3s ease;
        }
        .flow-node:hover {
          border-color: #7ce0d0;
          transform: translateY(-2px);
        }
        .node-step {
          font: 600 0.6rem var(--font-public-sans), sans-serif;
          color: #78CBE9;
          letter-spacing: 0.12em;
          display: block;
          margin-bottom: 0.4rem;
        }
        .flow-node h3 {
          margin: 0 0 0.4rem 0;
          color: #fff;
          font: 600 1.4rem var(--font-space-grotesk), sans-serif;
          letter-spacing: 0.05em;
        }
        .flow-node p {
          margin: 0;
          color: rgba(222, 244, 252, 0.7);
          font-size: 0.88rem;
        }
        .node-core {
          border-color: rgba(124, 224, 208, 0.4);
          background: rgba(8, 60, 97, 0.5);
          box-shadow: 0 0 25px rgba(124, 224, 208, 0.1);
        }
        .node-core h3 {
          color: #7ce0d0;
        }
        .state-pills {
          display: flex;
          justify-content: center;
          gap: 0.8rem;
          margin-top: 0.8rem;
          flex-wrap: wrap;
        }
        .state-pills span {
          background: rgba(1, 9, 21, 0.6);
          border: 1px solid rgba(120, 203, 233, 0.25);
          color: #eaf7ff;
          font: 500 0.78rem var(--font-space-grotesk), sans-serif;
          padding: 0.3rem 0.75rem;
          border-radius: 2px;
        }
        .flow-connector {
          display: flex;
          flex-direction: column;
          align-items: center;
          color: #7ce0d0;
          font-size: 1.2rem;
          margin: 0.2rem 0;
        }
        .arrow-line {
          width: 1px;
          height: 18px;
          background: rgba(124, 224, 208, 0.4);
        }
        .domain-output-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1.2rem;
          width: 100%;
          margin-top: 0.5rem;
        }
        .domain-box {
          background: rgba(3, 17, 36, 0.9);
          border: 1px solid rgba(120, 203, 233, 0.2);
          border-radius: 4px;
          padding: 1.4rem 1rem;
          text-align: center;
          transition: all 0.25s ease;
        }
        .domain-box:hover {
          border-color: #7ce0d0;
          background: rgba(8, 60, 97, 0.4);
        }
        .d-num {
          font: 600 0.65rem var(--font-space-grotesk), sans-serif;
          color: #7ce0d0;
          display: block;
          margin-bottom: 0.4rem;
        }
        .domain-box h4 {
          margin: 0 0 0.5rem 0;
          color: #fff;
          font: 600 1.05rem var(--font-space-grotesk), sans-serif;
          letter-spacing: 0.05em;
        }
        .d-sub {
          margin: 0;
          color: rgba(222, 244, 252, 0.65);
          font-size: 0.78rem;
          line-height: 1.4;
        }
        @media (max-width: 900px) {
          .domain-output-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        @media (max-width: 550px) {
          .domain-output-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  );
}
