# OceanEmbed — Cowork Task: Display Recent Real Argo Context in Live Mode

*Small, additive UI task. Backend already returns this data — confirmed working — this task only displays it.*

---

## Context

Every live prediction result now includes a `recent_argo_context` field:

```json
"recent_argo_context": {
  "surface_temp_c": 25.11,
  "date": "2026-09-08",
  "days_ago": 5,
  "lat": 16.82,
  "lon": 56.39,
  "distance_km": 180.0
}
```

This can also be `null` if no real Argo float reported anywhere near that point in the last 30 days — a genuinely possible, valid outcome, not an error.

**What this represents:** the closest REAL Argo float measurement from recent weeks — genuine ocean truth, but from a different exact date and location than the live prediction. **This must never be presented as validating the live number** — it's honest supporting context, not a comparison or accuracy claim.

## What to Build

In the `LIVE` mode view (in the same MODEL VALIDATION area where the "not yet validated" note currently appears, right below or alongside it), add a small, clearly-separated block:

**If `recent_argo_context` is present:**
```
NEARBY RECENT ARGO READING
24.8°C — real float measurement from Sep 8, 2026 (5 days ago), ~180km away
```

**If `recent_argo_context` is `null`:**
```
No real Argo float has reported within 30 days near this location.
```
(Show this plainly, don't hide the section — it's honest information either way.)

**Styling guidance:** visually distinct from the main "not yet validated" note (different background tint or a subtle border is enough) so a viewer doesn't confuse "here's a real nearby reading" with "here's a validation of our number." A small caption is worth adding: *"For reference only — not the same date or exact location as this prediction."*

## Non-Negotiables

- Never state or visually imply this is a validation, comparison, or accuracy check of the live prediction
- Always show the real `distance_km` and `days_ago` — never hide or round away how far apart in space/time this reference point actually is
- Handle the `null` case explicitly and honestly — don't just hide the section silently, since that could look like a bug rather than an expected "no nearby float" outcome

## Verify

- Click a live point where `recent_argo_context` is present — confirm the block shows the real temperature, real date, real distance, clearly separated from the main validation note
- If you can find or construct a case where it's `null`, confirm the honest "no float nearby" message displays correctly
- Confirm this new block does not appear in `HISTORICAL` mode (it's a live-mode-only concept)

## If Anything Is Unclear

Ask before proceeding — especially about exact placement/styling if the MODEL VALIDATION area is visually tight and needs a different layout approach to fit this cleanly.
