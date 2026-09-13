# OceanEmbed Intelligence & About Us Package Manifest

This document records all files included in `OceanEmbed-Intelligence-AboutUs-Handoff/`, their original source paths, relative package paths, purpose, and requirement status.

---

## File Manifest

| # | Source Path | Handoff Path | Purpose | Status |
|---|---|---|---|---|
| 1 | `ocean-hero-app/app/intelligence/page.tsx` | `app/intelligence/page.tsx` | Main route for `/intelligence` workstation | REQUIRED |
| 2 | `ocean-hero-app/app/about-us/page.tsx` | `app/about-us/page.tsx` | Main route for `/about-us` page | REQUIRED |
| 3 | `ocean-hero-app/app/about-us/about.css` | `app/about-us/about.css` | Stylesheet for `/about-us` page layout and typography | REQUIRED |
| 4 | `ocean-hero-app/components/intelligence/FisheriesModule.jsx` | `components/intelligence/FisheriesModule.jsx` | Fisheries scientific workstation module | REQUIRED |
| 5 | `ocean-hero-app/components/intelligence/OceanHealthModule.jsx` | `components/intelligence/OceanHealthModule.jsx` | Ocean Health subsurface thermal anomaly module | REQUIRED |
| 6 | `ocean-hero-app/components/intelligence/OffshoreModule.jsx` | `components/intelligence/OffshoreModule.jsx` | Offshore Intelligence site-assessment module | REQUIRED |
| 7 | `ocean-hero-app/components/intelligence/MaritimeModule.jsx` | `components/intelligence/MaritimeModule.jsx` | Maritime ocean-aware route-planning module | REQUIRED |
| 8 | `ocean-hero-app/components/intelligence/OceanLocationMap.jsx` | `components/intelligence/OceanLocationMap.jsx` | D3 Equirectangular interactive map component | REQUIRED |
| 9 | `ocean-hero-app/components/intelligence/InteractiveIntelligenceExplorer.jsx` | `components/intelligence/InteractiveIntelligenceExplorer.jsx` | Explorer tab container for Intelligence | REQUIRED |
| 10 | `ocean-hero-app/components/intelligence/IntelligenceEngineFlow.jsx` | `components/intelligence/IntelligenceEngineFlow.jsx` | Workflow diagram component | REQUIRED |
| 11 | `ocean-hero-app/components/SiteNavbar.jsx` | `components/SiteNavbar.jsx` | Primary navigation bar | REQUIRED |
| 12 | `ocean-hero-app/components/Footer.jsx` | `components/Footer.jsx` | Shared site footer component | REQUIRED |
| 13 | `ocean-hero-app/data/RealCurrentDataProvider.js` | `data/RealCurrentDataProvider.js` | Real HYCOM surface current data loader | REQUIRED |
| 14 | `ocean-hero-app/data/RealGLORYSDataProvider.js` | `data/RealGLORYSDataProvider.js` | Real GLORYS ocean model data loader | REQUIRED |
| 15 | `ocean-hero-app/data/RealProfileDataProvider.js` | `data/RealProfileDataProvider.js` | Real Argo water-column thermal profile loader | REQUIRED |
| 16 | `ocean-hero-app/data/RealSalinityDataProvider.js` | `data/RealSalinityDataProvider.js` | Real Salinity data loader | REQUIRED |
| 17 | `ocean-hero-app/data/RealSSTDataProvider.ts` | `data/RealSSTDataProvider.ts` | Real NOAA OISST sea surface temperature loader | REQUIRED |
| 18 | `ocean-hero-app/lib/geodesicRoute.js` | `lib/geodesicRoute.js` | Geodesic math, vector projections & water path routing | REQUIRED |
| 19 | `ocean-hero-app/public/data/indianOcean.geojson` | `public/data/indianOcean.geojson` | Indian Ocean land polygon geometry dataset | REQUIRED |
| 20 | `ocean-hero-app/public/oceanembed-logo-v2.png` | `public/oceanembed-logo-v2.png` | OceanEmbed brand logo image asset | REQUIRED |
| 21 | `ocean-hero-app/next.config.ts` | `next.config.ts` | Next.js configuration and route redirect rules | REQUIRED |
| 22 | N/A | `DEPENDENCIES.md` | Required npm packages documentation | REQUIRED |
| 23 | N/A | `ENVIRONMENT.example` | Template for environment variable keys | REQUIRED |
| 24 | N/A | `ENVIRONMENT.md` | Explanation of environment keys | REQUIRED |
| 25 | N/A | `INTEGRATION.md` | Step-by-step teammate integration guide | REQUIRED |
| 26 | N/A | `README.md` | Package overview documentation | REQUIRED |

---

## Verification Summary
- **Source Project Modifications**: None (`git status` clean).
- **Secrets / Sensitive Keys**: None included.
- **AI Models / Training Data**: None included.
- **Total Copied Source Files**: 21 files.
- **Total Package Documentation Files**: 5 files.
