'use client';
import React from 'react';

export default function SolutionFeatures() {
  return (
    <section className="solution-features">
      {/* FEATURE 1 */}
      <article className="feature-block">
        <div className="content-side">
          <span className="eyebrow">SURFACE OBSERVATIONS</span>
          <h2 className="heading">See what satellites can measure.</h2>
          <p className="description">
            OceanEmbed brings together surface observations such as sea surface temperature and other remotely sensed signals to reveal changing conditions across the ocean.
          </p>
        </div>
        <div className="visual-side">
          <svg viewBox="0 0 300 200" className="ft-svg">
            <ellipse cx="150" cy="180" rx="120" ry="25" fill="#061e33" stroke="#15799e" strokeWidth="0.5" />
            <path d="M 90 180 Q 150 160 210 180" fill="none" stroke="#e28c31" strokeWidth="2" opacity="0.6" />
            <line x1="150" y1="20" x2="150" y2="180" stroke="#7ce0d0" strokeWidth="0.5" strokeDasharray="2 3" opacity="0.5" />
            <circle cx="150" cy="20" r="4" fill="#fff" />
            <rect x="135" y="18" width="8" height="4" fill="#3bb3cb" />
            <rect x="157" y="18" width="8" height="4" fill="#3bb3cb" />
          </svg>
        </div>
      </article>

      {/* FEATURE 2 */}
      <article className="feature-block reverse">
        <div className="content-side">
          <span className="eyebrow">SUBSURFACE RECONSTRUCTION</span>
          <h2 className="heading">Explore what happens beneath the surface.</h2>
          <p className="description">
            Direct ocean observations are much more limited below the skin of the water. OceanEmbed helps reconstruct subsurface conditions using available observations and computational model-based analysis up to thousands of meters in depth.
          </p>
        </div>
        <div className="visual-side">
          <svg viewBox="0 0 300 200" className="ft-svg">
             <text x="30" y="20" fill="#78CBE9" fontSize="6">0m</text>
             <line x1="50" y1="18" x2="250" y2="18" stroke="#7ce0d0" strokeWidth="0.5" strokeDasharray="1 2" />
             
             <text x="25" y="60" fill="#78CBE9" fontSize="6">200m</text>
             <line x1="50" y1="58" x2="250" y2="58" stroke="#15799e" strokeWidth="0.5" strokeDasharray="1 2" />
             
             <text x="25" y="120" fill="#78CBE9" fontSize="6">500m</text>
             <line x1="50" y1="118" x2="250" y2="118" stroke="#083c61" strokeWidth="0.5" strokeDasharray="1 2" />
             
             <text x="20" y="180" fill="#78CBE9" fontSize="6">1000m</text>
             <line x1="50" y1="178" x2="250" y2="178" stroke="#031124" strokeWidth="0.5" strokeDasharray="1 2" />
             
             {/* Interpolation visual */}
             <path d="M 120 18 Q 180 60 140 118 T 130 178" fill="none" stroke="#fff" strokeWidth="1.5" />
             <circle cx="120" cy="18" r="2" fill="#fff" />
             <circle cx="130" cy="178" r="2" fill="#fff" />
          </svg>
        </div>
      </article>

      {/* FEATURE 3 */}
      <article className="feature-block">
        <div className="content-side">
          <span className="eyebrow">OCEAN VARIABLES</span>
          <h2 className="heading">Read the ocean through more than temperature.</h2>
          <p className="description">
             By interconnecting Sea Surface Temperature (SST), Salinity (SSS), Height (SSH), and local Vector Currents, OceanEmbed bridges disparate sensing regimes into one unified physical representation.
          </p>
        </div>
        <div className="visual-side">
           <svg viewBox="0 0 300 200" className="ft-svg">
              <circle cx="150" cy="100" r="40" fill="none" stroke="#15799e" strokeWidth="1" strokeDasharray="2 2" />
              <text x="150" y="102" fill="#fff" fontSize="8" textAnchor="middle" fontWeight="bold">OCEAN STATE</text>
              
              <line x1="150" y1="60" x2="150" y2="25" stroke="#7ce0d0" strokeWidth="0.5" />
              <text x="150" y="20" fill="#7ce0d0" fontSize="7" textAnchor="middle">SST</text>
              
              <line x1="110" y1="100" x2="60" y2="100" stroke="#7ce0d0" strokeWidth="0.5" />
              <text x="45" y="103" fill="#7ce0d0" fontSize="7" textAnchor="middle">SSS</text>
              
              <line x1="190" y1="100" x2="240" y2="100" stroke="#7ce0d0" strokeWidth="0.5" />
              <text x="255" y="103" fill="#7ce0d0" fontSize="7" textAnchor="middle">SSH</text>
              
              <line x1="150" y1="140" x2="150" y2="175" stroke="#7ce0d0" strokeWidth="0.5" />
              <text x="150" y="185" fill="#7ce0d0" fontSize="7" textAnchor="middle">CURRENT U/V</text>
           </svg>
        </div>
      </article>

      <style>{`
        .solution-features {
          width: 100%;
          max-width: 1400px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: clamp(4rem, 8vw, 8rem);
          padding: 4rem clamp(1.5rem, 6vw, 6.5rem) 8rem clamp(1.5rem, 6vw, 6.5rem);
        }

        .feature-block {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 4rem;
        }

        .feature-block.reverse {
          flex-direction: row-reverse;
        }

        .content-side {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 0.8rem;
        }

        .visual-side {
          flex: 1.2;
          background: rgba(1, 7, 14, 0.4);
          border: 1px solid rgba(120, 203, 233, 0.1);
          border-radius: 4px;
          height: 300px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ft-svg {
          width: 100%;
          height: 100%;
        }

        .eyebrow {
          font-family: var(--font-space-grotesk), sans-serif;
          color: #7ce0d0;
          font-size: 0.75rem;
          letter-spacing: 0.1em;
          font-weight: 600;
        }

        .heading {
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: clamp(2rem, 3.5vw, 3rem);
          line-height: 1.1;
          color: #fff;
          font-weight: 600;
          letter-spacing: -0.02em;
          margin: 0;
        }

        .description {
          font-size: 1.1rem;
          line-height: 1.6;
          color: rgba(238, 250, 255, 0.7);
        }

        @media (max-width: 900px) {
          .feature-block, .feature-block.reverse {
            flex-direction: column;
            gap: 2rem;
          }
          .visual-side {
            width: 100%;
            height: 250px;
          }
        }
      `}</style>
    </section>
  );
}
