import React from 'react';
import Image from 'next/image';
import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="ocean-footer">
      <div className="footer-layout">
        
        {/* TOP / BRAND SECTION */}
        <div className="footer-brand">
          <div className="logo-container">
            <Link href="/">
              <Image 
                src="/oceanembed-logo-v2.png" 
                alt="OceanEmbed Logo" 
                width={200} 
                height={60} 
                className="footer-logo"
                priority
              />
            </Link>
          </div>
          <p className="footer-desc">
            Exploring the ocean through data, science, and interactive visualization.
          </p>
        </div>

        {/* NAVIGATION SECTIONS */}
        <div className="footer-nav-groups">
          <div className="footer-nav-col">
            <h4>EXPLORE</h4>
            <Link href="/">Explorer</Link>
            <Link href="/solution">Solution</Link>
            <Link href="/technology">Models</Link>
          </div>
          <div className="footer-nav-col">
            <h4>OCEAN DATA</h4>
            <Link href="/data">Argo Floats</Link>
            <Link href="/data">GLORYS Reanalysis</Link>
            <Link href="/technology">Integration</Link>
          </div>
          <div className="footer-nav-col">
            <h4>RESOURCES</h4>
            <Link href="/data">About Us</Link>
            <Link href="/technology">Documentation</Link>
            <Link href="/api-docs">API Docs</Link>
          </div>
        </div>

      </div>

      {/* BOTTOM SECTION */}
      <div className="footer-bottom">
        <p className="copyright">© 2026 OceanEmbed</p>
        <div className="legal-links">
          <Link href="#">Privacy</Link>
          <Link href="#">Terms</Link>
        </div>
      </div>

      <style>{`
        .ocean-footer {
          background-color: transparent;
          padding: 7rem 5% 4rem;
          font-family: inherit;
          z-index: 50;
          position: relative;
        }

        .footer-layout {
          max-width: 1240px;
          margin: 0 auto;
          display: grid;
          grid-template-columns: 1fr 2fr;
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
          color: rgba(238, 250, 255, 0.7);
          font-family: var(--font-public-sans), sans-serif;
          font-size: 0.95rem;
          line-height: 1.6;
          margin: 0;
          font-weight: 400;
        }

        .footer-nav-groups {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 3rem;
        }

        .footer-nav-col h4 {
          color: #fff;
          font-family: var(--font-space-grotesk), sans-serif;
          font-size: 0.85rem;
          letter-spacing: 0.1em;
          font-weight: 600;
          margin-top: 0;
          margin-bottom: 2rem;
          text-transform: uppercase;
        }

        .footer-nav-col a {
          display: block;
          color: rgba(120, 203, 233, 0.6);
          font-family: var(--font-public-sans), sans-serif;
          text-decoration: none;
          font-size: 0.95rem;
          font-weight: 400;
          margin-bottom: 1.2rem;
          letter-spacing: 0.02em;
          transition: color 0.25s ease;
        }

        .footer-nav-col a:hover {
          color: #7ce0d0;
        }

        .footer-bottom {
          max-width: 1240px;
          margin: 6rem auto 0;
          padding-top: 0;
          border-top: none; 
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.8rem;
          font-weight: 400;
          color: rgba(120, 203, 233, 0.4);
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
          color: rgba(238, 250, 255, 0.8);
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
