# OceanEmbed — Integration Guide for Teammates

This package provides a clean, portable snapshot of the **Ocean Intelligence Workstation** and **About Us** modules to integrate into an existing OceanEmbed codebase without overwriting other routes.

---

## Step-by-step Integration Steps

### STEP 1: Copy Files
Copy the directory structure from `OceanEmbed-Intelligence-AboutUs-Handoff/` into your destination Next.js project root:

- `app/intelligence/page.tsx` → `app/intelligence/page.tsx`
- `app/about-us/page.tsx` → `app/about-us/page.tsx`
- `app/about-us/about.css` → `app/about-us/about.css`
- `components/intelligence/*` → `components/intelligence/*`
- `components/SiteNavbar.jsx` → `components/SiteNavbar.jsx` (Compare before replacing if you have modified navigation)
- `components/Footer.jsx` → `components/Footer.jsx` (Compare before replacing)
- `data/*` → `data/*`
- `lib/geodesicRoute.js` → `lib/geodesicRoute.js`
- `public/data/indianOcean.geojson` → `public/data/indianOcean.geojson`
- `public/oceanembed-logo-v2.png` → `public/oceanembed-logo-v2.png`

### STEP 2: Install npm Dependencies
Run the following in your target project root:
```bash
npm install d3-geo @emailjs/browser
```

### STEP 3: Configure Environment Variables (Optional)
If using the Contact Form on `/about-us`, add the EmailJS credentials to your `.env.local`:
```env
NEXT_PUBLIC_EMAILJS_SERVICE_ID=your_service_id
NEXT_PUBLIC_EMAILJS_TEMPLATE_ID=your_template_id
NEXT_PUBLIC_EMAILJS_PUBLIC_KEY=your_public_key
```

### STEP 4: Next.js Redirects (`next.config.ts`)
Ensure your `next.config.ts` includes redirects for legacy route names:
```typescript
async redirects() {
  return [
    { source: '/platform', destination: '/', permanent: true },
    { source: '/technology', destination: '/model', permanent: true },
    { source: '/data', destination: '/about-us', permanent: true },
  ];
}
```

### STEP 5: Verification & Dev Server
Run the local dev server:
```bash
npm run dev
```
Navigate to:
- `http://localhost:3000/intelligence`
- `http://localhost:3000/about-us`

Verify that:
1. All four Intelligence workstation modules (Fisheries, Ocean Health, Offshore, Maritime) switch cleanly.
2. The interactive map in Maritime allows Origin A and Destination B selection and calculates Great-Circle vs Water-Constrained routes.
3. `/about-us` renders dark ocean styling, particle visualizers, and contact form correctly.

---

## Integration Warnings & Potential Conflicts
> [!WARNING]
> If your existing codebase contains modifications to `components/SiteNavbar.jsx` or `components/Footer.jsx`, diff your local version before replacing to preserve any custom navigation links.
