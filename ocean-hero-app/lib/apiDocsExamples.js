// Every snippet shown on /api-docs lives here, so the page displays exactly
// the text that was run against the real backend when the page was written.
// Each one starts with a BASE definition set to the live deployment below.

export const BASE_URL = "https://oceanembed-backend.azurewebsites.net";

export const snippets = {
  curlLive: `curl -N "${BASE_URL}/api/live-predict/stream?lat=13.14&lon=86.75"`,

  curlLiveNoCoverage: `curl -N "${BASE_URL}/api/live-predict/stream?lat=15&lon=78"`,

  curlState: `curl "${BASE_URL}/api/ocean-state?lat=13.14&lon=86.75"`,

  curlBadParam: `curl -i "${BASE_URL}/api/ocean-state?lat=abc&lon=86"`,

  jsStream: `const BASE = "${BASE_URL}";

const res = await fetch(\`\${BASE}/api/live-predict/stream?lat=13.14&lon=86.75\`);
const reader = res.body.getReader();
const decoder = new TextDecoder();
let buffer = "";
let result = null;

while (true) {
  const { value, done } = await reader.read();
  if (done) break;
  buffer += decoder.decode(value, { stream: true });
  const messages = buffer.split("\\n\\n");
  buffer = messages.pop();
  for (const msg of messages) {
    if (!msg.startsWith("data: ")) continue; // skips ": keep-alive" comments
    const event = JSON.parse(msg.slice(6));
    if (event.error) throw new Error(event.error);
    if (event.done) result = event.result;
    else console.log(event.step);
  }
}

console.log(result.surface_state, result.profile.predicted_temp_c);`,

  pyStream: `import json
import requests

BASE = "${BASE_URL}"

with requests.get(
    f"{BASE}/api/live-predict/stream",
    params={"lat": 13.14, "lon": 86.75},
    stream=True,
    timeout=300,
) as r:
    r.raise_for_status()
    for line in r.iter_lines(decode_unicode=True):
        if not line.startswith("data: "):
            continue  # blank separators and ": keep-alive" comments
        event = json.loads(line[6:])
        if event.get("error"):
            raise RuntimeError(event["error"])
        if event["done"]:
            result = event["result"]
        else:
            print(event["step"])

print(result["surface_state"], result["profile"]["predicted_temp_c"])`,

  eventSource: `const BASE = "${BASE_URL}";

const es = new EventSource(\`\${BASE}/api/live-predict/stream?lat=13.14&lon=86.75\`);
es.onmessage = (e) => {
  const ev = JSON.parse(e.data);
  if (ev.done) {
    es.close(); // without this, EventSource would auto-reconnect and re-run the fetch
    console.log(ev.result ?? ev.error);
  } else {
    console.log(ev.step);
  }
};
es.onerror = () => es.close();`,

  jsState: `const BASE = "${BASE_URL}";

const res = await fetch(\`\${BASE}/api/ocean-state?lat=13.14&lon=86.75\`);
if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
const state = await res.json();

console.log(state.surface.sst_c, state.derived.current_speed_ms);
console.log(state.provenance);`,

  pyState: `import requests

BASE = "${BASE_URL}"

r = requests.get(
    f"{BASE}/api/ocean-state",
    params={"lat": 13.14, "lon": 86.75},
    timeout=300,  # the live fetch can take well over a minute
)
r.raise_for_status()
state = r.json()

print(state["surface"]["sst_c"], state["derived"]["current_speed_ms"])
print(state["provenance"])`,
};
