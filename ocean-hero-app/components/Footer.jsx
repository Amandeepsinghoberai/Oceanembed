import React from 'react';
import Image from 'next/image';

export default function Footer() {
  return (
    <footer className="ocean-footer">
      <div className="footer-layout">
        
        {/* TOP / BRAND SECTION */}
        <div className="footer-brand">
          <div className="logo-container">
            <Image 
              src="/oceanembed-logo-v2.png" 
              alt="OceanEmbed Logo" 
              width={260} 
              height={70} 
              className="footer-logo"
              priority
            />
          </div>
          <p className="footer-desc">
            Exploring the ocean through data, science, and interactive visualization.
          </p>
        </div>

        {/* NAVIGATION SECTIONS */}
        <div className="footer-nav-groups">
          <div className="footer-nav-col">
            <h4>EXPLORE</h4>
            <a href="#">Platform</a>
            <a href="#">Solution</a>
            <a href="#">Technology</a>
          </div>
          <div className="footer-nav-col">
            <h4>OCEAN DATA</h4>
            <a href="#">Argo Floats</a>
            <a href="#">GLORYS Reanalysis</a>
            <a href="#">Integration</a>
          </div>
          <div className="footer-nav-col">
            <h4>RESOURCES</h4>
            <a href="#">About Us</a>
            <a href="#">Documentation</a>
            <a href="#">Impact</a>
          </div>
        </div>

      </div>

      {/* BOTTOM SECTION */}
      <div className="footer-bottom">
        <p className="copyright">© 2026 OceanEmbed</p>
        <div className="legal-links">
          <a href="#">Privacy</a>
          <a href="#">Terms</a>
        </div>
      </div>

      <style>{`
        .ocean-footer {
          background-color: #01070e;
          padding: 8rem 5% 4rem;
          font-family: inherit;
          z-index: 50;
          position: relative;
        }

        .footer-layout {
          max-width: 1240px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1.2fr 2fr;
          gap: 6rem;
        }

        .footer-brand {
          max-width: 320px;
        }

        .logo-container {
          margin-bottom: 2rem;
        }
        
        .footer-logo {
          width: 160px;
          height: auto;
          object-fit: contain;
          object-position: left center;
          mix-blend-mode: screen;
        }

        .footer-desc {
          color: rgba(255, 255, 255, 0.45);
          font-size: 0.9rem;
          line-height: 1.7;
          letter-spacing: 0.02em;
          margin: 0;
          font-weight: 400;
        }

        .footer-nav-groups {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 3rem;
        }

        .footer-nav-col h4 {
          color: rgba(255, 255, 255, 0.9);
          font-family: "Bricolage Grotesque", sans-serif;
          font-size: 0.72rem;
          letter-spacing: 0.15em;
          font-weight: 600;
          margin-top: 0;
          margin-bottom: 2rem;
          text-transform: uppercase;
        }

        .footer-nav-col a {
          display: block;
          color: rgba(255, 255, 255, 0.45);
          text-decoration: none;
          font-size: 0.88rem;
          font-weight: 400;
          margin-bottom: 1.25rem;
          letter-spacing: 0.03em;
          transition: color 0.25s ease;
        }

        .footer-nav-col a:hover {
          color: #ffffff;
        }

        .footer-bottom {
          max-width: 1240px;
          margin: 7rem auto 0;
          padding-top: 2rem;
          border-top: 1px solid rgba(255, 255, 255, 0.08);
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.78rem;
          font-weight: 400;
          color: rgba(255, 255, 255, 0.35);
          letter-spacing: 0.08em;
        }

        .legal-links {
          display: flex;
          gap: 3rem;
        }

        .legal-links a {
          color: inherit;
          text-decoration: none;
          transition: color 0.25s ease;
        }

        .legal-links a:hover {
          color: rgba(255, 255, 255, 0.8);
        }

        @media (max-width: 900px) {
          .footer-layout {
            grid-template-columns: 1fr;
            gap: 4rem;
          }
        }

        @media (max-width: 600px) {
          .ocean-footer {
            padding: 5rem 5% 3rem;
          }
          .footer-nav-groups {
            grid-template-columns: 1fr;
            gap: 3rem;
          }
          .footer-bottom {
            margin-top: 4rem;
            flex-direction: column;
            gap: 1.5rem;
            align-items: flex-start;
          }
        }
      `}</style>
    </footer>
  );
}
