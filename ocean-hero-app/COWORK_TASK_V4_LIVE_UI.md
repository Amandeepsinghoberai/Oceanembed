# OceanEmbed — Cowork Task: Redesign Live Mode as a Toggle, Not a Stack

*This is a UI/UX refactor of the existing, working live-mode feature. The live fetch logic itself (backend, SSE, step messages) is correct and already proven working — do not change any of that. This task only changes how the result is DISPLAYED.*

---

## The Problem

Right now, clicking "GET LIVE PREDICTION" adds a second, smaller, separate block below the existing historical display — a duplicate mini profile chart, duplicate temperature number, etc. This looks like two disconnected panels rather than one coherent feature.

## The Fix — A Single Toggle

Add a small two-option toggle/tab control near the top of the point-detail panel, above "LOCATION": **`HISTORICAL` | `LIVE`**.

- **`HISTORICAL` (default, selected on point click):** shows exactly what's currently shown today — temperature, date, Argo comparison, RMSE/Bias/Correlation, profile chart with both predicted and Argo lines.
- **`LIVE` (on click):** the **same visual slots** — same position for the big temperature number, same position for the date, same position for the profile chart, same position for the surface-state grid — but their *content* swaps to live data:
  - Temperature number shows the live predicted surface value
  - Date field shows "LIVE — [most recent real date data was fetched from]"
  - Where Argo comparison / RMSE / Bias / Correlation normally show, instead show: *"Not yet validated against Argo — real Argo data for this date won't be available for several weeks"* (small, clearly styled as informational, not an error)
  - Profile chart shows a single line (predicted only, no dashed Argo line — there isn't one yet)
  - Surface-state grid shows the same fields as today's implementation (2 for Bay of Bengal, 6 for Arabian Sea)
  - **While fetching:** show the existing step-by-step checklist (already built, works correctly) directly in the space where the temperature number / chart will appear, then transition smoothly into the result once the `"complete"` message arrives

**Switching from `LIVE` back to `HISTORICAL` and back again should not re-fetch anything** — cache the live result in component state for that point until a different point is clicked or the page is refreshed, so re-toggling is instant.

**Switching to a different point on the map should reset the toggle back to `HISTORICAL` by default** — always show the guaranteed, instant view first for any newly selected point; live is always an explicit additional action per point, never automatic.

## What NOT to Change

- The backend (`backend/main.py`, `backend/live_predict.py`) — the SSE stream, the step sequence (2-step Bay of Bengal, 5-step Arabian Sea), and all fetch logic are correct and proven working. Do not touch them.
- Do not add any fabricated Argo comparison, RMSE, or confidence number for the live result — there genuinely isn't one, and the UI must say so plainly, not hide the absence.
- Do not remove or change the underlying `EventSource`/SSE consumption logic — only restructure how its results are laid out and displayed.

## Verify

- Click a point, confirm `HISTORICAL` is shown by default
- Click `LIVE`, confirm the step checklist appears in-place, then resolves into a live result using the same layout positions as the historical view
- Toggle back to `HISTORICAL`, confirm original data is unchanged and still there
- Toggle to `LIVE` again for the same point, confirm it does NOT re-fetch (uses the cached result from the first fetch)
- Click a different point, confirm it resets to `HISTORICAL` by default, and `LIVE` for this new point does trigger a fresh fetch

## If Anything Is Unclear

Ask before proceeding — especially if the existing step-checklist component isn't easily reusable in the new inline position, or if caching per-point live results in state conflicts with how point-switching is currently handled.
