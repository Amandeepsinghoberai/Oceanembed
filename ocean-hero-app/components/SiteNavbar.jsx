"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Image from "next/image";

export default function SiteNavbar() {
  const pathname = usePathname();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    let lastScroll = window.scrollY;
    const handleScroll = () => {
      const currentScroll = window.scrollY;
      if (currentScroll > lastScroll && currentScroll > 50) {
        setHidden(true);
      } else if (currentScroll < lastScroll) {
        setHidden(false);
      }
      lastScroll = currentScroll;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <>
      <header className={`ocean-nav site-nav ${hidden ? 'nav-hidden' : ''}`}>
        <Link href="/" className="brand" aria-label="OceanEmbed home">
          <Image 
            src="/oceanembed-logo-v2.png" 
            alt="OceanEmbed Logo" 
            width={160} 
            height={48} 
            style={{ height: "48px", width: "auto", mixBlendMode: "screen" }} 
            priority
          />
        </Link>
        <nav aria-label="Primary navigation">
          <Link href="/" className={pathname === "/" ? "active" : ""}>PLATFORM</Link>
          <Link href="/solution" className={pathname === "/solution" ? "active" : ""}>SOLUTION</Link>
          <Link href="/technology" className={pathname === "/technology" ? "active" : ""}>TECHNOLOGY</Link>
          <Link href="/data" className={pathname === "/data" ? "active" : ""}>DATA</Link>
          <Link href="/impact" className={pathname === "/impact" ? "active" : ""}>IMPACT</Link>
        </nav>
        <div className="nav-depth" style={{ opacity: 0, pointerEvents: 'none', visibility: 'hidden' }}>
          <span></span><b>000m</b>
        </div>
      </header>

      <style>{`
        .ocean-nav.site-nav {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: 70px;
          padding: 0 clamp(1rem, 4vw, 4rem);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 2rem;
          color: #eefaff;
          /* Force navbar over absolutely everything */
          z-index: 99999 !important;
          pointer-events: none !important;
          background: transparent;
          transition: transform 0.3s ease-in-out;
        }

        .ocean-nav.site-nav.nav-hidden {
          transform: translateY(-100%);
        }

        .site-nav .brand,
        .site-nav nav {
          /* Restore clicks to interactive zones */
          pointer-events: auto !important;
        }
        .brand {
          border: 0;
          background: none;
          color: inherit;
          display: flex;
          align-items: center;
          gap: 0.7rem;
          cursor: pointer;
          text-decoration: none;
          /* Faster mobile tap */
          touch-action: manipulation;
        }
        .ocean-nav nav {
          display: flex;
          align-items: center;
          gap: clamp(1rem, 2.5vw, 2.4rem);
        }
        @media (min-width: 900px) {
          .ocean-nav nav {
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
          }
        }
        .ocean-nav nav a {

          border: 0;
          background: none;
          color: inherit;
          font: 600 0.68rem/1 "Public Sans", sans-serif;
          letter-spacing: 0.12em;
          text-decoration: none;
          cursor: pointer;
          opacity: 0.72;
          position: relative;
          padding: 0.5rem 0;
          /* Prevent double tap issues and enforce direct input */
          touch-action: manipulation;
          user-select: none;
          -webkit-user-select: none;
        }
        .ocean-nav nav a::after {
          content: "";
          position: absolute;
          left: 0;
          right: 100%;
          bottom: 0;
          height: 1px;
          background: #7ce0d0;
          transition: right 0.3s ease;
        }
        .ocean-nav nav a:hover,
        .ocean-nav nav a.active {
          opacity: 1;
        }
        /* We remove the hover transition on touch devices that causes double taps */
        @media (hover: hover) and (pointer: fine) {
          .ocean-nav nav a:hover::after,
          .ocean-nav nav a.active::after {
            right: 0;
          }
        }
        /* Mobile/touch fallback for active state */
        @media (hover: none) {
          .ocean-nav nav a.active::after {
            right: 0;
          }
        }
        .nav-depth {
          display: none;
        }
        @media (max-width: 900px) {
          .ocean-nav nav { gap: 1rem; }
        }
        @media (max-width: 700px) {
          .ocean-nav.site-nav { height: 64px; }
          .ocean-nav nav a:nth-child(n+3) { display: none; }
        }
      `}</style>
    </>
  );
}
