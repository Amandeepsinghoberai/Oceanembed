# OceanEmbed — Cowork Task: Click Anywhere in the Region + Fix Overlapping Markers

*Two related frontend changes. Backend already supports arbitrary coordinates — no backend changes needed for the click-anywhere part.*

---

## Part A — Click Anywhere in the Region for a Live Prediction

**Currently:** the map only allows clicking the 5 pre-defined demo markers.

**Change:** allow clicking **anywhere within the actual covered region** (Bay of Bengal: roughly 5°N–22°N, 77°E–100°E; Arabian Sea: roughly 5°N–30°N, 45°E–77°E — use the real boundaries already defined elsewhere in the codebase, e.g. wherever `BAY_LON_MIN` / region-splitting logic already exists, rather than hardcoding new ones here). Clicking any point within these bounds should:

1. Read the exact lat/lon of the click
2. Call the existing `/api/live-predict/stream?lat={lat}&lon={lon}` endpoint — **this already works for arbitrary coordinates, verified directly.** No backend changes needed for this part.
3. Show the same result panel already built (temperature, date, profile chart, surface-state grid), using the same step checklist already built

**Critical distinction — new points vs. the 5 existing demo points:**

- The 5 existing demo points (their exact lat/lon, matching the existing `demo_*.json` files) keep working exactly as they do now: both `HISTORICAL` and `LIVE` tabs available, historical data still loads from the static file.
- **Any other point the user clicks has no historical file and never will.** For these:
  - Hide or disable the `HISTORICAL` tab entirely (don't show an empty/broken historical view)
  - Default straight to `LIVE` mode, or show a single-mode view (no toggle needed if there's only one mode available)
  - Add a small, honest note: *"This is a new location — live prediction only. Our 5 highlighted points also include historical validation against real Argo measurements."* (or similar wording — the point is to be clear about why some points have more data than others, and to indirectly highlight that the 5 demo points are special/richer, not to hide that distinction)

**Clicking outside both regions** (e.g., open ocean far from either coast, or land) should show a clear message — *"No coverage at this location"* — not attempt a fetch that will fail or return nonsense.

## Part B — Fix the Overlapping Marker

There are two markers near the Arabian Sea coast (visible in the current build near ~19-20°N, 58°E) positioned close enough together that one blocks clicks to the other at the default zoom level.

**Fix approach (pick whichever fits the existing map library best — Leaflet based on earlier investigation):**
- If markers are within some small pixel distance of each other at the current zoom, either: nudge their visual positions apart slightly (a small deterministic offset), or make the click target open a small chooser ("2 locations here — which one?") listing both
- Ensure this fix generalizes — don't hardcode a special case for just these two specific coordinates, since Part A means many more points can now be clicked close together

---

## Non-Negotiables

- The 5 existing demo points' behavior must not change at all — same historical data, same live capability, same toggle
- Never show a fabricated historical/Argo comparison for a newly-clicked arbitrary point
- Never let a click silently fail with no feedback — always show either a result, a loading state, or a clear "no coverage" message

## Verify

- Click one of the 5 known demo points — confirm both tabs still work exactly as before
- Click a brand-new point inside the Bay of Bengal (not one of the 5) — confirm it triggers a real live fetch with the correct 2-step sequence and shows a result with no historical tab/data
- Click a brand-new point inside the Arabian Sea — confirm the 5-step sequence and correct 6-field surface state
- Click clearly outside both regions (e.g., mid-Pacific, or well inland) — confirm a clean "no coverage" message, not an error or a stuck loading state
- Confirm the two previously-overlapping markers can now both be individually clicked and give correct, different results

## If Anything Is Unclear

Ask before proceeding — especially about the exact real region boundaries to use (pull them from existing code rather than guessing), or if the mapping library makes the "nudge apart" vs "chooser popup" approach for Part B meaningfully harder than the other.
