# OceanEmbed — Cowork Task: Add a Regional Sea Surface Temperature Heatmap

*Additive only — the map's click-anywhere and marker behavior (from the previous task) must not change.*

---

## Context

We now have a real, pre-fetched grid of sea surface temperature covering the whole region (Bay of Bengal + Arabian Sea), saved as a static file: `public/data/regional_sst_grid.json`.

**This grid is NOT an AI prediction — it's the raw satellite reading, shown purely as visual context so a viewer can see which areas are warmer or cooler at a glance.** It must never be labeled as a model output, and it is intentionally a fixed, periodically-refreshed snapshot, not a live-on-every-pageload fetch — this keeps the map instant and avoids repeated slow network calls for something that's just a visual backdrop.

**File shape:**
```json
{
  "date": "2026-09-10",
  "generated_at": "2026-09-12T18:52:27+00:00",
  "lat_min": 5.0, "lat_max": 29.95,
  "lon_min": 45.0, "lon_max": 99.95,
  "lat_step": 0.25, "lon_step": 0.25,
  "values": [[26.4, 26.5, null, ...], [...], ...]
}
```
`values` is a 2D array, rows ordered by latitude, columns by longitude, starting at `lat_min`/`lon_min` and stepping by `lat_step`/`lon_step`. `null` entries are land or missing data — must be rendered as fully transparent, not a color.

## What to Build

1. **Load `regional_sst_grid.json` once** when the map component mounts.
2. **Render it as a semi-transparent color overlay** on the existing SVG/d3-geo map, underneath the existing markers and click layer (markers and clicks must remain fully interactive and visually on top).
3. **Color scale:** cool blue for colder values, warm red/orange for warmer values — a standard sequential temperature color scale. Pick reasonable min/max bounds from the actual data range in the file (compute `min`/`max` across all non-null `values` at load time) rather than hardcoding a guessed range.
4. **Add a small legend** near the heatmap (color gradient bar with a few labeled temperature values) so it's readable, not just decorative.
5. **Add a small, clearly visible caption near the heatmap**, e.g.: *"Sea Surface Temperature — [date from the file's `date` field], via satellite (Copernicus Marine)"* — this must NOT say "AI prediction" or "OceanEmbed model," since it isn't one.
6. **Add a toggle to show/hide the heatmap layer** (e.g., a small button or checkbox near the map controls) — some users may want the clean map without the overlay, especially the first time they're just exploring where the 5 demo points are.

## Non-Negotiables

- The heatmap is visual context only — never implied to be a model prediction, never used as an input to any prediction shown elsewhere in the app
- Markers, the click-anywhere interaction, and the marker chooser popup (from the previous task) must remain fully functional and visually on top of the heatmap layer
- Don't fetch this data live on page load or on click — it's a static, pre-generated file, loaded once
- If `regional_sst_grid.json` is missing or fails to load, the rest of the map (markers, clicking, live predictions) must continue working normally — fail gracefully, don't block the whole map

## Verify

- Heatmap renders with a visible, sensible blue-to-red gradient across the region
- Land areas and missing data show as transparent, not a solid color
- Legend is present and readable
- Caption correctly shows the real date from the file, and does not claim to be an AI prediction
- Toggling the heatmap off/on works
- All previously-built interactions (5 demo points, click-anywhere, marker chooser, historical/live toggle) still work identically with the heatmap on or off

## If Anything Is Unclear

Ask before proceeding — especially if the existing d3-geo map setup makes overlaying a raster/grid layer meaningfully different from adding more SVG markers, or if the color scale library choice isn't obvious from the existing dependencies.
