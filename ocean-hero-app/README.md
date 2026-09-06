# OceanEmbed — Ocean Hero (Next.js + TypeScript)

A minimal Next.js App Router project wired up exactly per `INTEGRATION.md`:
`OceanHero` (a dependency-free, scroll-driven SVG hero — boat + satellite at
the surface, an Argo float descending on a tether to 1000 m as you scroll)
rendered as the first thing on the homepage.

## What's here

```
ocean-hero-app/
├── app/
│   ├── layout.tsx     — loads Bricolage Grotesque + Public Sans (Step 2)
│   ├── page.tsx        — renders <OceanHero /> first, per the hard requirement
│   └── globals.css     — minimal reset; deliberately has NO overflow-hidden
│                          rule (see the comment inside — Step 4's sticky trap)
├── components/
│   └── OceanHero.jsx   — the deliverable, copied over byte-for-byte
├── reference/
│   └── ocean-hero.html — the standalone reference build, for comparison
└── INTEGRATION.md      — the original integration guide, included as-is
```

`OceanHero.jsx` is kept as plain `.jsx` (not converted to `.tsx`) on purpose —
`INTEGRATION.md` explicitly warns against hand-converting its inline SVG
string to JSX (kebab-case SVG attributes vs. JSX's camelCase), and the file
declares itself dependency-free. `tsconfig.json` has `allowJs: true`, so it
sits fine next to the typed `.tsx` files without any conversion risk.

## Running it

Requires Node 18.18+.

```bash
cd ocean-hero-app
npm install
npm run dev
```

Then open http://localhost:3000. Compare it against `reference/ocean-hero.html`
(open that file directly in a browser) — they should look and behave
identically.

## Before you change anything

Read `INTEGRATION.md` first — specifically:

- **Step 4** — the sticky-positioning trap. If the scene scrolls away
  instead of staying pinned, something upstream picked up
  `overflow: hidden` / `overflow-x: hidden`. Use `overflow-x: clip` instead
  if you need to suppress a horizontal scrollbar.
- **"Things not to change"** — don't convert the SVG to JSX, don't replace
  the fraction-based (`X()`/`Y()`) positioning with fixed pixels, don't
  render two copies on one page, and don't remove the `useEffect` cleanup
  (it stops the scroll/resize listeners and the animation loop).
- **Tuning** — scroll length (`.ocean-track { height: 460vh }`), timing/depth
  (`CFG`), and horizontal/vertical placement (`FX` / `FY`) are all grouped
  near the top of the `useEffect` inside `OceanHero.jsx`.

## Verifying the build

Follow `INTEGRATION.md`'s Step 5 checklist: at-rest layout, slow scroll
(pin + boat shrink + waterline rise), continued scroll (depth ruler +
darkening water + particles past ~200 m), scrolling back up, window resize,
mobile width (390px), and navigating away and back (checks the cleanup).
