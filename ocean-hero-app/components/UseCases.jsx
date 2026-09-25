"use client";

import React from "react";
import Link from "next/link";

// Homepage "who is this for" section. Wording is the brief's own honest,
// one-line summaries of the Intelligence page's 4 real modules — kept to
// what those modules actually do, not expanded scope. See each module's own
// scope disclaimer for the full, precise wording:
//   FisheriesModule.jsx, MaritimeModule.jsx, OceanHealthModule.jsx, OffshoreModule.jsx
const USE_CASES = [
  { title: "Fisheries", text: "Check real physical ocean conditions for fishing activity planning." },
  { title: "Maritime & Shipping", text: "Real current and wind data for route planning decision support." },
  { title: "Climate & Ocean Research", text: "Monitor real subsurface temperature and flag unusual conditions against a real climatology baseline." },
  { title: "Offshore Operations", text: "Real site-condition data through the water column for planning and monitoring." },
];

export default function UseCases() {
  return (
    <section className="uc-root">
      <div className="uc-inner">
        <div className="uc-kicker">WHO THIS IS FOR</div>
        <h2 className="uc-title">Built for real ocean decisions.</h2>
        <div className="uc-grid">
          {USE_CASES.map((c) => (
            <div className="uc-card" key={c.title}>
              <h3>{c.title}</h3>
              <p>{c.text}</p>
            </div>
          ))}
        </div>
        <Link href="/intelligence" className="uc-link">See the full Intelligence modules →</Link>
      </div>

      <style>{`
        .uc-root { width: 100%; display: flex; justify-content: center; padding: 5rem clamp(1.5rem, 6vw, 6.5rem) 4rem; background: #041526; color: #eefaff; }
        .uc-inner { width: 100%; max-width: 1400px; }
        .uc-kicker { font: 600 0.7rem var(--font-public-sans), sans-serif; letter-spacing: 0.14em; color: #7ce0d0; }
        .uc-title { margin: 0.4rem 0 2rem; font: 700 clamp(1.8rem, 3vw, 2.6rem) var(--font-space-grotesk), sans-serif; color: #fff; letter-spacing: -0.01em; }
        .uc-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1.2rem; }
        .uc-card { padding: 1.4rem 1.3rem; background: rgba(4, 21, 38, 0.6); border: 1px solid rgba(120, 203, 233, 0.15); border-radius: 4px; }
        .uc-card h3 { margin: 0 0 0.6rem; font: 700 1rem var(--font-space-grotesk), sans-serif; color: #7ce0d0; }
        .uc-card p { margin: 0; font-size: 0.82rem; line-height: 1.55; color: rgba(238, 250, 255, 0.78); }
        .uc-link { display: inline-block; margin-top: 2rem; font: 600 0.75rem var(--font-space-grotesk), sans-serif; letter-spacing: 0.03em; color: #78CBE9; text-decoration: none; border-bottom: 1px solid rgba(120, 203, 233, 0.4); padding-bottom: 2px; }
        .uc-link:hover { color: #fff; border-color: #fff; }
        @media (max-width: 1000px) { .uc-grid { grid-template-columns: 1fr 1fr; } }
        @media (max-width: 560px) { .uc-grid { grid-template-columns: 1fr; } }
      `}</style>
    </section>
  );
}
