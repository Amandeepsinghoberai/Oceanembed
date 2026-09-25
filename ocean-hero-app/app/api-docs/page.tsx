import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import { snippets, BASE_URL } from "@/lib/apiDocsExamples";
import capture from "@/lib/apiDocsCapture.json";

export const metadata = {
  title: "API Documentation | OceanEmbed",
  description:
    "How to call OceanEmbed's live ocean endpoints: /api/live-predict/stream and /api/ocean-state, with real tested requests and responses.",
};

type SseEvent = { t: number; data: Record<string, unknown> };
type Sse = { events: SseEvent[]; elapsed_s: number; captured_at: string; keepalive_comments: number };

const liveBay = capture.live_bay as unknown as Sse;
const liveArabian = capture.live_arabian as unknown as Sse;
const stateStream = capture.state_stream_bay as unknown as Sse;
const stateBay = capture.state_bay;
const stateArabian = capture.state_arabian;

const arabianDates = (liveArabian.events[liveArabian.events.length - 1].data as { result: { data_dates: Record<string, string> } }).result.data_dates;
const json = (v: unknown) => JSON.stringify(v, null, 2);
const day = (iso: string) => iso.slice(0, 10);

// Render a captured SSE stream exactly as it goes over the wire, with the
// second each event arrived at (measured when the response was captured).
const wire = (s: Sse) =>
  s.events.map((e) => `data: ${JSON.stringify(e.data)}\n\n   ↑ arrived ${e.t.toFixed(1)} s after the request`).join("\n\n");

function Code({ children, label }: { children: string; label?: string }) {
  return (
    <div className="ad-code">
      {label && <div className="ad-code-label">{label}</div>}
      <pre>{children}</pre>
    </div>
  );
}

function Params({ rows }: { rows: [string, string, string, string][] }) {
  return (
    <div className="ad-table-wrap">
      <table className="ad-table">
        <thead>
          <tr><th>Name</th><th>Type</th><th>Required</th><th>Meaning</th></tr>
        </thead>
        <tbody>
          {rows.map(([n, t, r, m]) => (
            <tr key={n}><td><code>{n}</code></td><td>{t}</td><td>{r}</td><td>{m}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ApiDocsPage() {
  const measured = [
    ["/api/live-predict/stream", "Bay of Bengal (13.14, 86.75)", liveBay.elapsed_s],
    ["/api/live-predict/stream", "Arabian Sea (19.36, 58.65)", liveArabian.elapsed_s],
    ["/api/ocean-state", "Bay of Bengal (13.14, 86.75)", capture.state_bay.elapsed_s],
    ["/api/ocean-state", "Arabian Sea (19.36, 58.65)", capture.state_arabian.elapsed_s],
    ["/api/ocean-state/stream", "Bay of Bengal (13.14, 86.75)", stateStream.elapsed_s],
  ] as const;

  return (
    <main className="ad-page">
      <SiteNavbar />

      <div className="ad-wrap">
        <header className="ad-hero">
          <span className="ad-eyebrow">API DOCUMENTATION</span>
          <h1>Calling OceanEmbed from your own code</h1>
          <p>
            Two endpoints return a live, fresh reading of the ocean at any point in our coverage: a predicted
            temperature profile down to 1000 m, plus the surface state it was computed from. Every request and
            response on this page was run against our real backend, and each was captured on {day(liveBay.captured_at)}. Nothing is mocked
            or hand-written.
          </p>
        </header>

        <section className="ad-callout" id="timing">
          <h2>Read this first: live requests are slow</h2>
          <p>
            These endpoints do not read a prepared table. Each request fetches fresh satellite and reanalysis data
            from Copernicus Marine and runs our model on it, so <strong>a request typically takes 5 to 90 seconds, and can take
            longer</strong>. Most of the time is spent waiting for the data provider.
          </p>
          <p>The five real calls captured for this page took:</p>
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead><tr><th>Endpoint</th><th>Point</th><th>Total time</th></tr></thead>
              <tbody>
                {measured.map(([e, p, s]) => (
                  <tr key={e + p}><td><code>{e}</code></td><td>{p}</td><td>{s.toFixed(1)} s</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            One of those (<code>/api/ocean-state</code>, Arabian Sea) took {capture.state_arabian.elapsed_s.toFixed(0)} seconds, longer than the 90 s figure above. Set your
            HTTP client timeout to at least 5 minutes and never call these from a page that needs an instant answer.
            Prefer <code>/api/live-predict/stream</code> if a person is waiting, since it reports progress while the fetch runs.
          </p>
        </section>

        <nav className="ad-toc" aria-label="On this page">
          <a href="#basics">Basics</a>
          <a href="#live-predict">/api/live-predict/stream</a>
          <a href="#ocean-state">/api/ocean-state</a>
          <a href="#freshness">Data freshness</a>
          <a href="#errors">Errors</a>
        </nav>

        <section id="basics">
          <h2>Basics</h2>
          <ul>
            <li>
              <strong>Base URL.</strong> <code>{BASE_URL}</code>, the live deployment. Every example on this page uses it.
            </li>
            <li>
              <strong>Method.</strong> <code>GET</code> for everything, with parameters in the query string.
            </li>
            <li>
              <strong>Authentication.</strong> None: no API keys.
            </li>
            <li>
              <strong>Rate limit.</strong> The three live endpoints (<code>/api/live-predict/stream</code>, <code>/api/ocean-state</code> and
              <code> /api/ocean-state/stream</code>) share one limit of <strong>5 requests per minute per IP address</strong> (a rolling
              60-second window). Requests over the limit get HTTP 429 with a <code>Retry-After</code> header. Requests rejected for bad
              parameters do not count.
            </li>
            <li>
              <strong>CORS.</strong> Open to every origin (<code>access-control-allow-origin: *</code>), so browsers can call it directly.
            </li>
            <li>
              <strong>Coverage.</strong> Latitude 5°N to 30°N. Longitude 45°E up to (not including) 77°E is the Arabian Sea model;
              80°E to 100°E is the Bay of Bengal model. The band from 77°E to 80°E, and everything else, has no model.
            </li>
          </ul>
          <p className="ad-note">
            Because each live call triggers real, costly upstream fetches, please keep to one request at a time and don&apos;t poll.          </p>
        </section>

        <section id="live-predict">
          <h2><code>GET /api/live-predict/stream</code></h2>
          <p>
            Predicts the temperature profile at a point and streams progress as it works, using Server-Sent Events (SSE). The
            response is <code>text/event-stream</code>. Use this when a person is waiting.
          </p>

          <h3>Parameters</h3>
          <Params rows={[
            ["lat", "number", "yes", "Latitude in decimal degrees, 5 to 30."],
            ["lon", "number", "yes", "Longitude in decimal degrees east, 45 to <77 or 80 to 100."],
          ]} />

          <h3>The stream</h3>
          <p>
            Each message is one line starting with <code>data: </code> holding a JSON object, followed by a blank line. Progress
            events look like <code>{`{"step": "...", "done": false}`}</code>. The last event has <code>{`"done": true`}</code> and either a
            <code> result</code> or an <code>error</code>. While the backend is silent for a long stretch it sends a comment line
            starting with <code>:</code> every 15 seconds so proxies don&apos;t drop the connection; skip lines that don&apos;t start
            with <code>data: </code>. (Our Arabian Sea capture received {liveArabian.keepalive_comments} such comment.)
          </p>
          <p>
            The progress messages depend on the region. Bay of Bengal points report SST, sea level, and the nearby-Argo check; Arabian Sea
            points also report salinity, mixed layer depth, and wind/rotation, because that model uses those extra inputs.
          </p>

          <h3>Example: curl</h3>
          <p><code>-N</code> turns off curl&apos;s output buffering so you see events as they arrive.</p>
          <Code label="request">{snippets.curlLive}</Code>
          <Code label={`real response, Bay of Bengal, captured ${day(liveBay.captured_at)}, ${liveBay.elapsed_s.toFixed(1)} s total`}>{wire(liveBay)}</Code>

          <h3>The result object</h3>
          <Code label="the last event above, pretty-printed">{json(liveBay.events[liveBay.events.length - 1].data)}</Code>
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead><tr><th>Field</th><th>Meaning</th></tr></thead>
              <tbody>
                <tr><td><code>location</code></td><td>The point you asked for and the region that handled it (<code>Bay of Bengal</code> or <code>Arabian Sea</code>).</td></tr>
                <tr><td><code>mode</code></td><td>Always <code>live</code> for this endpoint.</td></tr>
                <tr><td><code>data_dates</code></td><td>The real date of each input the model used. Different inputs lag by different amounts; see <a href="#freshness">Data freshness</a>.</td></tr>
                <tr><td><code>surface_state</code></td><td>The inputs at the surface. Bay: <code>sst_c</code>, <code>ssh_m</code>. Arabian Sea adds <code>sss_psu</code>, <code>mld_m</code>, <code>wind_stress_curl</code>, <code>eddy_vorticity</code>.</td></tr>
                <tr><td><code>profile</code></td><td><code>depths_m</code> (15 depths, 0 to 1000 m) and <code>predicted_temp_c</code>, the model&apos;s temperature at each depth.</td></tr>
                <tr><td><code>recent_argo_context</code></td><td>The closest recent real Argo float measurement, for context. It is not used as a model input and is not a validation of this prediction. It carries <code>status</code>, and when found: <code>surface_temp_c</code>, <code>date</code>, <code>days_ago</code>, <code>lat</code>, <code>lon</code>, <code>distance_km</code>.</td></tr>
              </tbody>
            </table>
          </div>

          <h3>Arabian Sea response</h3>
          <Code label={`real response, Arabian Sea (19.36, 58.65), captured ${day(liveArabian.captured_at)}, ${liveArabian.elapsed_s.toFixed(1)} s total`}>{wire(liveArabian)}</Code>

          <h3>Example: JavaScript (Node 18+ or a browser)</h3>
          <p>
            Read the response body as a stream. This works with any <code>fetch</code> and lets you send headers if you put a gateway in front.
          </p>
          <Code label="Node (ES module) or browser console">{snippets.jsStream}</Code>

          <h3>Example: JavaScript with EventSource (browser)</h3>
          <Code label="browser">{snippets.eventSource}</Code>

          <h3>Example: Python</h3>
          <Code label="requests">{snippets.pyStream}</Code>

          <h3>Outside coverage</h3>
          <p>
            A point with no model is not an HTTP error. You get status 200 and a single event, straight away:
          </p>
          <Code label="request">{snippets.curlLiveNoCoverage}</Code>
          <Code label="real response (0.2 s)">{`data: {"step": "error", "done": true, "error": "No coverage at this location"}`}</Code>
        </section>

        <section id="ocean-state">
          <h2><code>GET /api/ocean-state</code></h2>
          <p>
            Returns one JSON document with the whole picture at a point: surface state, predicted subsurface profile, a climatology
            reference (Bay of Bengal only), and derived quantities. There is no progress reporting: the connection stays open with no
            body until the whole document is ready. The wait is the same 5 to 90+ seconds described above.
          </p>

          <h3>Parameters</h3>
          <Params rows={[
            ["lat", "number", "yes", "Latitude in decimal degrees."],
            ["lon", "number", "yes", "Longitude in decimal degrees east."],
          ]} />

          <h3>Example: curl</h3>
          <Code label="request">{snippets.curlState}</Code>
          <Code label={`real response, Bay of Bengal, captured ${day(stateBay.captured_at)}, ${stateBay.elapsed_s.toFixed(1)} s`}>{json(stateBay.body)}</Code>

          <h3>Fields</h3>
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead><tr><th>Field</th><th>Unit / meaning</th></tr></thead>
              <tbody>
                <tr><td><code>surface.sst_c</code></td><td>Sea surface temperature, °C.</td></tr>
                <tr><td><code>surface.sss_psu</code></td><td>Sea surface salinity, PSU.</td></tr>
                <tr><td><code>surface.current_u_ms</code>, <code>current_v_ms</code></td><td>Eastward and northward surface current, m/s.</td></tr>
                <tr><td><code>surface.ssh_m</code></td><td>Sea surface height anomaly, m.</td></tr>
                <tr><td><code>surface.wind_u_ms</code>, <code>wind_v_ms</code></td><td>Eastward and northward wind at the surface, m/s.</td></tr>
                <tr><td><code>subsurface</code></td><td><code>depth_m</code> (15 depths) with the model&apos;s <code>temperature_c</code> at each. <code>valid</code> is <code>false</code> when no prediction could be made.</td></tr>
                <tr><td><code>reference</code></td><td>GLORYS climatological temperature at the same 15 depths (<code>temperature_c_by_depth</code>). Bay of Bengal only; elsewhere <code>source</code> and the array are <code>null</code> and <code>same_depth</code> is <code>false</code>.</td></tr>
                <tr><td><code>derived</code></td><td>Speed and direction of current and wind, the vertical temperature gradient (°C per m, 14 values between the 15 depths), and <code>temperature_anomaly_c</code> (prediction minus climatology, so <code>null</code> outside the Bay).</td></tr>
                <tr><td><code>provenance</code></td><td>Which data sources contributed to this response.</td></tr>
              </tbody>
            </table>
          </div>
          <p>
            <code>current_direction_deg</code> and <code>wind_direction_deg</code> are compass bearings (0° = north, clockwise) of the
            direction the vector points <em>toward</em>, computed as <code>atan2(u, v)</code>. For wind this is the opposite of the
            meteorological convention, which names the direction the wind blows <em>from</em>. In the Bay of Bengal example,
            u = 4.4 and v = 1.58 give 70.2°.
          </p>

          <h3>Missing values are <code>null</code>, never guessed</h3>
          <p>
            This endpoint never fails because one upstream source is down. Any field it could not fetch comes back <code>null</code>, and
            its source is left out of <code>provenance</code>. Always check for <code>null</code>. The Arabian Sea response below shows the
            legitimate case: no climatology reference exists there.
          </p>
          <Code label={`real response, Arabian Sea (19.36, 58.65), captured ${day(stateArabian.captured_at)}, ${stateArabian.elapsed_s.toFixed(1)} s`}>{json(stateArabian.body)}</Code>

          <h3>Example: JavaScript</h3>
          <Code label="Node (ES module) or browser console">{snippets.jsState}</Code>

          <h3>Example: Python</h3>
          <Code label="requests">{snippets.pyState}</Code>

          <h3>Outside coverage</h3>
          <p>
            Also not an HTTP error: you get 200 immediately with the same shape but every value <code>null</code>, <code>subsurface.valid</code> set
            to <code>false</code>, and an empty <code>provenance</code>.
          </p>

          <h3>A streaming variant</h3>
          <p>
            <code>GET /api/ocean-state/stream?lat=&amp;lon=</code> takes the same parameters and returns the same document, but as SSE with progress
            events, ending in <code>{`{"step": "complete", "done": true, "result": {…}}`}</code>, where <code>result</code> is the JSON above. Parse it
            exactly as in the streaming examples for <code>/api/live-predict/stream</code>. Real events from the Bay of Bengal point ({stateStream.elapsed_s.toFixed(1)} s):
          </p>
          <Code label="progress events only (the final event is the JSON shown above)">{stateStream.events
            .filter((e) => e.data.done !== true)
            .map((e) => `data: ${JSON.stringify(e.data)}   ← ${e.t.toFixed(1)} s`)
            .join("\n") + `\ndata: {"step": "complete", "done": true, "result": …}   ← ${stateStream.events[stateStream.events.length - 1].t.toFixed(1)} s`}</Code>
        </section>

        <section id="freshness">
          <h2>Data freshness</h2>
          <p>
            &ldquo;Live&rdquo; means fetched now, not observed now. Near-real-time ocean products lag reality: in the captures above,
            SST, sea level, mixed layer depth and wind-stress curl were dated {arabianDates.sst},
            and salinity {arabianDates.sss}, against a capture date of {day(liveBay.captured_at)}.
            Read <code>data_dates</code> for the real date of each input. A result is a snapshot of the moment it was fetched, and the same
            request will give different numbers on a later day.
          </p>
        </section>

        <section id="errors">
          <h2>Errors</h2>
          <div className="ad-table-wrap">
            <table className="ad-table">
              <thead><tr><th>Situation</th><th>What you get</th></tr></thead>
              <tbody>
                <tr><td>Point outside coverage, <code>/api/live-predict/stream</code></td><td>HTTP 200, one event <code>{`{"step":"error","done":true,"error":"No coverage at this location"}`}</code></td></tr>
                <tr><td>Point outside coverage, <code>/api/ocean-state</code></td><td>HTTP 200, all values <code>null</code>, <code>subsurface.valid: false</code></td></tr>
                <tr><td>Missing or non-numeric <code>lat</code>/<code>lon</code></td><td>HTTP 422 with a JSON <code>detail</code> array naming the parameter</td></tr>
                <tr><td>More than 5 live requests in a minute from one IP</td><td>HTTP 429, a <code>Retry-After</code> header (seconds) and a JSON <code>detail</code> message. Applies to the streaming endpoints too, before any stream starts.</td></tr>
                <tr><td>Failure while a stream is running</td><td>A final event with <code>done: true</code> and an <code>error</code> string. Always check for <code>error</code> before <code>result</code>.</td></tr>
              </tbody>
            </table>
          </div>
          <p>Real 429, returned by the sixth live request inside one minute:</p>
          <Code label="real response (only the relevant headers shown)">{`HTTP/1.1 429 Too Many Requests
retry-after: 58
access-control-allow-origin: *

{"detail":"Rate limit exceeded: at most 5 live requests per minute per IP. Try again in 58 s."}`}</Code>
          <p>Real 422, from the request below:</p>
          <Code label="request">{snippets.curlBadParam}</Code>
          <Code label="real response (date, server and content-length headers left out)">{`HTTP/1.1 422 Unprocessable Content
content-type: application/json

{"detail":[{"type":"float_parsing","loc":["query","lat"],"msg":"Input should be a valid number, unable to parse string as a number","input":"abc"}]}`}</Code>
        </section>
      </div>

      <Footer />

      <style>{`
        .ad-page { min-height: 100vh; width: 100%; display: flex; flex-direction: column;
          background: linear-gradient(180deg, #0a4b73 0%, #083c61 12%, #031124 45%, #01070e 100%); color: #eefaff; font-family: var(--font-space-grotesk), system-ui, sans-serif; }
        .ad-hero h1, .ad-wrap h2 { font-family: var(--font-space-grotesk), system-ui, sans-serif; }
        .ad-wrap { width: 100%; max-width: 920px; margin: 0 auto; padding: 120px 20px 64px; box-sizing: border-box; }
        .ad-eyebrow { font-size: 0.7rem; letter-spacing: 0.18em; color: #78CBE9; font-weight: 600; }
        .ad-hero h1 { font-size: clamp(1.8rem, 5vw, 2.8rem); margin: 8px 0 14px; line-height: 1.15; }
        .ad-hero p, .ad-wrap p, .ad-wrap li { line-height: 1.65; color: rgba(238, 250, 255, 0.86); font-size: 0.98rem; }
        .ad-wrap h2 { font-size: 1.5rem; margin: 48px 0 12px; padding-top: 8px; border-top: 1px solid rgba(238, 250, 255, 0.12); }
        .ad-wrap h3 { font-size: 1.05rem; margin: 28px 0 8px; color: #7ce0d0; }
        .ad-wrap code { background: rgba(238, 250, 255, 0.1); padding: 1px 6px; border-radius: 4px; font-size: 0.88em; overflow-wrap: anywhere; }
        .ad-wrap a { color: #78CBE9; }
        .ad-callout { margin: 32px 0 0; padding: 20px 22px; border: 1px solid rgba(255, 196, 92, 0.55); background: rgba(255, 196, 92, 0.08); border-radius: 10px; }
        .ad-callout h2 { margin: 0 0 10px; padding: 0; border: 0; font-size: 1.25rem; color: #ffd27a; }
        .ad-note { border-left: 3px solid #78CBE9; padding-left: 14px; }
        .ad-toc { display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 28px 0 0; font-size: 0.9rem; }
        .ad-toc a { text-decoration: none; }
        .ad-toc a:hover { text-decoration: underline; }
        .ad-table-wrap { overflow-x: auto; margin: 10px 0 16px; }
        .ad-table { border-collapse: collapse; width: 100%; font-size: 0.88rem; }
        .ad-table th, .ad-table td { text-align: left; vertical-align: top; padding: 8px 12px; border-bottom: 1px solid rgba(238, 250, 255, 0.12); }
        .ad-table th { color: #78CBE9; font-weight: 600; font-size: 0.75rem; letter-spacing: 0.06em; text-transform: uppercase; }
        .ad-code { margin: 10px 0 18px; border: 1px solid rgba(238, 250, 255, 0.16); border-radius: 8px; background: rgba(1, 7, 14, 0.7); overflow: hidden; }
        .ad-code-label { padding: 6px 14px; font-size: 0.7rem; letter-spacing: 0.05em; color: rgba(238, 250, 255, 0.6); border-bottom: 1px solid rgba(238, 250, 255, 0.1); }
        .ad-code pre { margin: 0; padding: 14px; overflow-x: auto; font-size: 0.78rem; line-height: 1.55; max-height: 460px; color: #d8f3ff; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre; }
        @media (max-width: 600px) { .ad-wrap { padding-top: 96px; } }
      `}</style>
    </main>
  );
}
