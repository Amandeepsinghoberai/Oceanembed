# OceanEmbed — Intelligence & About Us Portable Handoff Package

## Purpose
This repository package is a self-contained, standalone snapshot of the **Ocean Intelligence Workstation** (`/intelligence`) and **About Us** (`/about-us`) modules from the OceanEmbed platform.

It is designed to be easily merged or integrated into another teammate's OceanEmbed codebase without affecting or overwriting unrelated pages.

---

## Included Features & Modules

### 1. Ocean Intelligence Workstation (`/intelligence`)
- **Fisheries Module**: Scientific environmental suitability workspace evaluating Sea Surface Temperature (SST), Salinity, and Surface Current velocity.
- **Ocean Health Module**: Subsurface ocean thermal profile inspector with depth-segmented controls (`0m–1000m`) and anomaly analysis against GLORYS baseline.
- **Offshore Module**: Site-assessment workstation with regional target presets (Arabian Sea, Krishna-Godavari, Lakshadweep) and sub-surface temperature inspection.
- **Maritime Module**: Map-first route-planning workstation featuring broad Indian Ocean viewport (35°E–110°E), strict land click rejection, Great-Circle reference arc, and water-constrained path routing around Sri Lanka and land chokepoints.
- **OceanLocationMap Component**: Interactive D3/Equirectangular map canvas with coordinate projection and land polygon detection (`indianOcean.geojson`).

### 2. About Us (`/about-us`)
- Overview of OceanEmbed's scientific mission and subsurface reconstruction framework.
- Interactive deep-learning pipeline visualizers.
- Contact form integration using EmailJS.

---

## Included Assets & Providers
- Real Data Providers: `RealCurrentDataProvider`, `RealGLORYSDataProvider`, `RealProfileDataProvider`, `RealSalinityDataProvider`, `RealSSTDataProvider`.
- Geodesic Navigation Engine: `lib/geodesicRoute.js`.
- GeoJSON Geometry: `public/data/indianOcean.geojson`.
- Brand Logo: `public/oceanembed-logo-v2.png`.

---

## What is NOT Included (Excluded by Design)
- Model training files (`training/`, `*.pt`, `*.pth`, `*.onnx`).
- API keys, credentials, or `.env` secrets.
- Unrelated landing page components (Explorer, Solution hero, Reconstruction demo).
