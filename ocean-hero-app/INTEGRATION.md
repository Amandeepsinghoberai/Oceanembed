# Adding the ocean hero animation to the Next.js site

A scroll-driven hero for the OceanEmbed homepage. A boat and satellite sit at the
sea surface; as the visitor scrolls, the boat shrinks toward the right edge and an
Argo float descends on a vertical tether to 1000 m, with depth markers scrolling
past and the water darkening.

You are given two files:

| File | What it's for |
|---|---|
| `OceanHero.jsx` | The component to add to the site. This is the deliverable. |
| `ocean-hero.html` | The same animation as a standalone page. Reference only — open it in a browser to see the intended result, or to tune values without rebuilding. |

Expect this to take about 20 minutes, most of it verification.

---

## Before you start

Confirm the project uses the **App Router** (`app/` directory) or the **Pages
Router** (`pages/` directory). Step 3 differs slightly. Everything else is the same.

The component has **no dependencies**. Nothing to install. It uses no animation
library, no `npm install`, and adds roughly 27 KB to the bundle.

---

## Step 1 — Add the component file

Copy `OceanHero.jsx` to:

```
components/OceanHero.jsx
```

If the project keeps components elsewhere (`src/components/`, `app/_components/`),
use that instead and adjust the import path in Step 3 to match.

Open it and confirm the first line is:

```js
"use client";
```

It must be there. The animation reads scroll position and manipulates the DOM, so
it cannot run as a server component.

---

## Step 2 — Add the fonts

The component's CSS asks for **Public Sans** and **Bricolage Grotesque**. These were
loaded by a `<link>` tag in the original standalone HTML, which did not carry over.
Add them through Next's font system instead.

### App Router — `app/layout.js` (or `.tsx`)

```js
import { Bricolage_Grotesque, Public_Sans } from "next/font/google";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "700"],
  variable: "--font-bricolage",
});

const publicSans = Public_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-public-sans",
});

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${bricolage.variable} ${publicSans.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
```

### Pages Router — `pages/_app.js`

Same two `next/font/google` calls, then wrap the app:

```js
export default function App({ Component, pageProps }) {
  return (
    <main className={`${bricolage.variable} ${publicSans.variable}`}>
      <Component {...pageProps} />
    </main>
  );
}
```

**If the site already loads these fonts, skip this step entirely.** Loading them
twice is wasteful but harmless.

**If you skip it deliberately**, the animation still works — it falls back to the
system sans-serif. It just looks slightly different from the reference HTML.

---

## Step 3 — Render it on the homepage

### App Router — `app/page.js`

```jsx
import OceanHero from "@/components/OceanHero";

export default function Home() {
  return (
    <main>
      <OceanHero />
      {/* everything else on the homepage goes below */}
    </main>
  );
}
```

### Pages Router — `pages/index.js`

Identical, minus the `"use client"` concern (Pages Router components are already
client components).

### One hard requirement

`<OceanHero />` must be the **first thing on the page**. It calculates scroll
progress from its own position relative to the top of the document. A navbar
rendered inside `layout.js` is fine — that sits outside the page. But any content
placed *above* it inside `page.js` will throw the timing off, and the animation will
appear to start partway through.

If you need a fixed/overlaid navbar, that works. Just don't put a
normal-flow element above the hero.

---

## Step 4 — Check for the sticky-positioning trap

**This is the most likely thing to go wrong. Check it even if the animation looks
fine at first.**

The whole effect depends on `position: sticky`. Sticky silently stops working if
*any* ancestor element has `overflow: hidden`, `overflow-x: hidden`, or
`overflow: auto`. It doesn't error — it just quietly behaves like `position: static`.

`overflow-x: hidden` on `html` or `body` is an extremely common line in global CSS
resets, usually added to stop horizontal scrollbars.

Search `globals.css` (and any layout wrapper) for:

```css
overflow-x: hidden;
overflow: hidden;
```

If you find it on `html`, `body`, or a wrapper `<div>` around the page content,
remove it. If something else on the site genuinely needs it, the fix is
`overflow-x: clip` instead — that stops horizontal scroll without breaking sticky.

**Symptom if you get this wrong:** the scene scrolls up and off the screen
immediately instead of staying pinned while the animation plays.

---

## Step 5 — Verify

Run `npm run dev` and check each of these:

1. **At rest** — large boat centered on the water, satellite upper-left, dashed
   beam between them with small dots travelling along it, Argo float hanging
   directly below the boat.
2. **Scroll slowly** — the scene stays pinned to the screen. The boat shrinks and
   moves right; the waterline rises. Nothing scrolls away.
3. **Keep scrolling** — depth numbers (100, 200 … 1000) scroll upward past the
   float. The water darkens. Small particles fade in below ~200 m.
4. **Scroll back up** — everything reverses smoothly. This should feel identical in
   both directions.
5. **Resize the browser window** — narrow and widen it. The boat should never get
   clipped at the top edge, and the depth numbers should stay on screen.
6. **Open on a phone** (or DevTools device mode at 390px) — the layout pulls
   inward. Depth numbers, float, and readout all remain visible.
7. **Navigate away and back** — no console errors, no visible slowdown. This
   confirms the cleanup is working.

Compare against `ocean-hero.html` opened directly in a browser. They should look
the same.

---

## Tuning

If you want to adjust anything, all the useful values are grouped together near the
top of the `useEffect` in `OceanHero.jsx`.

### Scroll length

In the `STYLES` block:

```css
.ocean-track { height: 460vh; }
```

That's how far the visitor scrolls to play the whole sequence. Lower it (`350vh`)
for a snappier feel, raise it for a slower, more cinematic one.

### Timing and depth

```js
const CFG = {
  maxDepth:   1000,   // metres at the end of the scroll
  pxPerMetre: 2.6,    // spacing of the depth ruler
  restEnd:    0.13,   // intro holds until here (0–1 of total scroll)
  moveEnd:    0.33,   // boat has finished moving away by here
  ease:       0.115,  // damping — lower is smoother and laggier
};
```

### Horizontal placement

```js
const FX = {
  boatRest: 0.486, boatEnd: 0.900,
  satRest:  0.181, satEnd:  0.288,
  floatRest:0.486, floatEnd:0.900,
  ruler:    0.620, tag:     0.048,
};
```

These are **fractions of the visible width**, not pixels. `0.900` means "90% across
whatever the browser is currently showing."

> `boatEnd` and `floatEnd` must stay **identical**. That's what keeps the tether
> hanging straight down. Change one, change both.

### Vertical placement

```js
const FY = { waterRest: 0.48, waterEnd: 0.17, floatRest: 0.62 };
```

Fractions of the visible height. If the boat ever looks too close to the top edge
on some screen, raise `waterEnd` toward `0.22`.

### Text

The five captions are plain text in the `MARKUP` string, inside
`<div class="captions">`. Each has `data-from` and `data-to` attributes giving the
depth range where it appears. Reword freely, or delete the whole block if the
homepage copy is going somewhere else.

---

## Things not to change

**Don't convert the SVG to JSX.** The artwork is injected as an HTML string via
`dangerouslySetInnerHTML`. This is deliberate: SVG uses kebab-case attributes
(`stop-color`, `stroke-width`, `text-anchor`) that JSX requires in camelCase.
Converting by hand is error-prone and gains nothing here — the markup is static and
comes from us, so there's no injection risk.

**Don't replace the fraction helpers with fixed pixel values.** `X()` and `Y()`
compute positions from the visible viewport at runtime. This is what stops the boat
being clipped on short windows and the depth ruler falling off narrow ones. Both of
those were real bugs during development, fixed exactly this way.

**Don't render two copies on one page.** The internals use `getElementById`, so two
instances would fight over the same element IDs. Fine as a single hero; just don't
reuse it elsewhere on the same page without prefixing the IDs first.

**Don't remove the cleanup return.** The `useEffect` returns a function that removes
the scroll and resize listeners and stops the animation loop. Without it, every
route change leaks a `requestAnimationFrame` loop and the site gets progressively
slower.

---

## Troubleshooting

| What you see | Cause | Fix |
|---|---|---|
| Scene scrolls away instead of staying pinned | `overflow: hidden` on an ancestor | Step 4 |
| Blank space where the hero should be, `React is not defined` in console | JSX transform config | The import at the top must be `import React, { useEffect, useRef } from "react"` — the default `React` is required, not just the hooks |
| Error mentioning `window` or `document` is not defined | Rendered as a server component | Confirm `"use client"` is line 1 |
| Animation starts partway through | Content above the hero in `page.js` | Move `<OceanHero />` to the top |
| Boat clipped at the top of the window | Fraction helpers replaced with fixed values | Revert; or raise `FY.waterEnd` |
| Depth numbers off-screen on mobile | Same as above | Same |
| Fonts look wrong | Step 2 not done | Add the fonts, or accept the fallback |
| Animation feels twitchy rather than weighted | `CFG.ease` raised too high | Lower it back toward `0.115` |

---

## Accessibility — already handled, don't remove

The component respects `prefers-reduced-motion`. Visitors who have enabled that OS
setting get the scene without the drifting particles or pulsing hint, and the
scroll response snaps rather than eases. This matters for people with vestibular
disorders. The relevant block is the `@media (prefers-reduced-motion: reduce)` rule
in `STYLES`, plus the `reduce` constant in the script.

The SVG carries an `aria-label` describing the scene for screen readers.

---

## One judgement call worth flagging

Real Argo floats **drift freely** — they are not tethered to a ship. The wire is
there because it was requested and it reads well visually as "this float is our
ground truth."

If an oceanographer is judging this, they may notice. It's easy to remove: delete
the `<path id="wire">` element from `MARKUP`, and the two lines in `draw()` that set
its `d` attribute. Everything else continues to work.
