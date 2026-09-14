'use client';

import React from 'react';

// Same real progress-checklist look the Solution page's live mode uses
// (components/solution/AnalysisPanel.jsx's .live-steps) — reused here
// rather than reimplemented, so the two pages read as the same product.
// Every entry in `steps` is a real step message forwarded straight from a
// real fetch completing server-side (see /api/ocean-state/stream) — never
// a fabricated/simulated progress animation.
export default function LiveStepsList({ steps }) {
  if (!steps || steps.length === 0) return null;

  return (
    <>
      <ul className="live-steps">
        {steps.map((step, i) => {
          const isLastStep = i === steps.length - 1;
          return (
            <li key={i} className={isLastStep ? 'active' : 'done'}>
              <span className="live-step-icon" />
              {step}
            </li>
          );
        })}
      </ul>
      <style>{`
        .live-steps {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.45rem;
        }
        .live-steps li {
          display: flex;
          align-items: center;
          gap: 0.55rem;
          font-size: 0.72rem;
          color: rgba(238, 250, 255, 0.45);
          transition: color 0.2s ease;
        }
        .live-steps li.done,
        .live-steps li.active {
          color: rgba(238, 250, 255, 0.9);
        }
        .live-step-icon {
          flex: 0 0 auto;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.6rem;
          line-height: 1;
        }
        .live-steps li.done .live-step-icon {
          background: #7ce0d0;
          color: #01070e;
        }
        .live-steps li.done .live-step-icon::before {
          content: "✓";
        }
        .live-steps li.active .live-step-icon {
          border: 2px solid rgba(120, 203, 233, 0.3);
          border-top-color: #7ce0d0;
          animation: liveSpin 0.8s linear infinite;
        }
        @keyframes liveSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
