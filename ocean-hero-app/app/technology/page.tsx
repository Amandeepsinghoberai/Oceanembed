'use client';

import { useState } from "react";
import SiteNavbar from "@/components/SiteNavbar";
import Footer from "@/components/Footer";
import OceanEmbedHeroVisualization from "@/components/technology/OceanEmbedHeroVisualization";

const pipeline = [
  { number: "01", title: "SURFACE OBSERVATIONS", text: "Daily SST, SSS, SSH / SLA, currents, and winds define the observed surface state.", tags: ["SST", "SSS", "SSH", "+4"] },
  { number: "02", title: "DATA HARMONIZATION", text: "Input fields are quality-checked and placed on the standardized 0.25° OceanEmbed grid.", tags: ["REGRID", "QC", "ALIGN"] },
  { number: "03", title: "OCEAN EMBEDDING", text: "The multi-variable surface state is converted into a learned representation.", tags: ["FEATURE ENCODING", "ML"] },
  { number: "04", title: "DEPTH-WISE RECONSTRUCTION", text: "The model reconstructs temperature at multiple depths from the ocean embedding.", tags: ["0–1000 m", "15 LEVELS"] },
  { number: "05", title: "GLORYS REFERENCE", text: "Reconstructed fields are evaluated against the GLORYS reanalysis reference target.", tags: ["REFERENCE", "DAILY"] },
  { number: "06", title: "ARGO VALIDATION", text: "Independent ARGO observations are used to assess real-world consistency.", tags: ["IN-SITU", "INDEPENDENT"] },
];

const depths = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000];
const evaluationDepths = [0, 50, 100, 200, 500, 1000];

const metrics = [
  { short: "RMSE", title: "Root Mean Square Error", text: "Magnitude of reconstruction error between predicted and reference temperature.", bob: "0.637°C", as: "0.834°C" },
  { short: "CORRELATION", title: "Pearson Correlation", text: "How closely predicted temperature variations follow the reference field.", bob: "0.997", as: "0.988" },
  { short: "BIAS", title: "Mean Prediction Error", text: "Whether the model systematically overestimates or underestimates temperature.", bob: null, as: null },
  { short: "MAE", title: "Mean Absolute Error", text: "The average absolute difference between prediction and reference.", bob: null, as: null },
];

// Real, validated per-depth evaluation results (RMSE °C, Pearson correlation)
// for each of the two regional models, against withheld ARGO profiles.
const BOB_DEPTH_METRICS = [
  { depth: 0, rmse: 0.261, corr: 0.949 }, { depth: 5, rmse: 0.241, corr: 0.958 }, { depth: 10, rmse: 0.250, corr: 0.960 },
  { depth: 20, rmse: 0.450, corr: 0.877 }, { depth: 30, rmse: 0.818, corr: 0.619 }, { depth: 50, rmse: 1.260, corr: 0.740 },
  { depth: 75, rmse: 1.430, corr: 0.854 }, { depth: 100, rmse: 1.464, corr: 0.867 }, { depth: 125, rmse: 1.300, corr: 0.861 },
  { depth: 150, rmse: 0.891, corr: 0.894 }, { depth: 200, rmse: 0.520, corr: 0.910 }, { depth: 300, rmse: 0.254, corr: 0.927 },
  { depth: 500, rmse: 0.202, corr: 0.921 }, { depth: 700, rmse: 0.173, corr: 0.938 }, { depth: 1000, rmse: 0.163, corr: 0.844 },
];
const ARABIAN_SEA_DEPTH_METRICS = [
  { depth: 0, rmse: 1.034, corr: 0.808 }, { depth: 5, rmse: 0.621, corr: 0.948 }, { depth: 10, rmse: 0.779, corr: 0.919 },
  { depth: 20, rmse: 0.962, corr: 0.875 }, { depth: 30, rmse: 1.237, corr: 0.822 }, { depth: 50, rmse: 1.330, corr: 0.821 },
  { depth: 75, rmse: 1.351, corr: 0.819 }, { depth: 100, rmse: 1.278, corr: 0.827 }, { depth: 125, rmse: 1.148, corr: 0.844 },
  { depth: 150, rmse: 1.026, corr: 0.865 }, { depth: 200, rmse: 1.050, corr: 0.872 }, { depth: 300, rmse: 0.846, corr: 0.886 },
  { depth: 500, rmse: 0.540, corr: 0.873 }, { depth: 700, rmse: 0.475, corr: 0.891 }, { depth: 1000, rmse: 0.431, corr: 0.879 },
];

// Fixed en-US thousands grouping — Number.toLocaleString() depends on the
// runtime's locale, which differs between server (SSR) and browser and
// causes a hydration mismatch. This is deterministic on both sides.
function formatCount(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

const REGION_SUMMARY: Record<string, { rmse: number; correlation: number; n: number; inputs: string[]; clusters: number }> = {
  "BAY OF BENGAL": { rmse: 0.637, correlation: 0.997, n: 30019, inputs: ["SST", "SSH"], clusters: 5 },
  "ARABIAN SEA": { rmse: 0.834, correlation: 0.988, n: 2129593, inputs: ["SST", "SSH", "Wind Stress Curl", "MLD", "SSS", "Eddy Vorticity"], clusters: 10 },
};

const uncertaintyFindings = [
  "Both regions reconstruct the near-surface layer (0–10 m) most reliably — Bay of Bengal RMSE holds at 0.24–0.26°C, Arabian Sea at 0.62–1.03°C.",
  "Error peaks in the thermocline, not at depth: Bay of Bengal peaks at 100 m (RMSE 1.464°C), Arabian Sea at 75 m (RMSE 1.351°C) — where vertical gradients are steepest.",
  "Deep water is easier, not harder, to reconstruct: below 500 m, Bay of Bengal falls to 0.163–0.202°C and Arabian Sea to 0.431–0.540°C.",
  "Arabian Sea error runs 2–5× higher than Bay of Bengal at nearly every depth — why its model adds four predictors beyond SST/SSH and clusters into 10 regions instead of 5.",
  "Per-point bias is computed for every prediction (see the 5 live examples on /solution) but isn't yet published as a regional aggregate.",
];

function SectionHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="section-heading">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </div>
  );
}

function PipelineFlashcard({ number, title, text, tags, emphasized }: { number: string; title: string; text: string; tags: string[]; emphasized?: boolean }) {
  return (
    <article className={`pipeline-card ${emphasized ? "emphasized" : ""}`}>
      <div className="step-number">{number}</div>
      <h3>{title}</h3>
      <p>{text}</p>
      <div className="card-tags">{tags.map(tag => <span key={tag}>{tag}</span>)}</div>
    </article>
  );
}

function MetricBlock({ short, title, text, bob, as }: { short: string; title: string; text: string; bob: string | null; as: string | null }) {
  const reported = bob !== null && as !== null;
  return (
    <div className="metric-block">
      <div className="metric-code">{short}</div><h3>{title}</h3><p>{text}</p>
      {reported ? (
        <div className="metric-values">
          <div><span>BAY OF BENGAL</span><strong>{bob}</strong></div>
          <div><span>ARABIAN SEA</span><strong>{as}</strong></div>
        </div>
      ) : (
        <>
          <div className="metric-value">—</div>
          <span className="metric-status">NOT REPORTED IN THIS EVALUATION RELEASE</span>
        </>
      )}
    </div>
  );
}

function DepthRmseChart() {
  const maxRmse = 1.6;
  const chartW = 640, chartH = 400;
  const marginL = 56, marginR = 20, marginT = 16, marginB = 34;
  const plotW = chartW - marginL - marginR;
  const plotH = chartH - marginT - marginB;
  const xFor = (rmse: number) => marginL + (rmse / maxRmse) * plotW;
  const yFor = (depth: number) => marginT + (depth / 1000) * plotH;
  const toPoints = (pts: { depth: number; rmse: number }[]) => pts.map(p => `${xFor(p.rmse)},${yFor(p.depth)}`).join(' ');
  const rmseTicks = [0, 0.5, 1.0, 1.5];
  const depthTicks = [0, 200, 500, 1000];

  return (
    <div className="depth-rmse-chart">
      <svg viewBox={`0 0 ${chartW} ${chartH}`} role="img" aria-label="Validated RMSE by depth for Bay of Bengal and Arabian Sea, against withheld ARGO profiles">
        {rmseTicks.map(t => <line key={`v-${t}`} x1={xFor(t)} y1={marginT} x2={xFor(t)} y2={chartH - marginB} className="chart-grid-line" />)}
        {depthTicks.map(d => <line key={`h-${d}`} x1={marginL} y1={yFor(d)} x2={chartW - marginR} y2={yFor(d)} className="chart-grid-line" />)}
        <polyline points={toPoints(BOB_DEPTH_METRICS)} className="chart-line bob-line" />
        <polyline points={toPoints(ARABIAN_SEA_DEPTH_METRICS)} className="chart-line as-line" />
        {BOB_DEPTH_METRICS.map(p => <circle key={`bob-${p.depth}`} cx={xFor(p.rmse)} cy={yFor(p.depth)} r="2.6" className="chart-dot bob-dot" />)}
        {ARABIAN_SEA_DEPTH_METRICS.map(p => <circle key={`as-${p.depth}`} cx={xFor(p.rmse)} cy={yFor(p.depth)} r="2.6" className="chart-dot as-dot" />)}
        {rmseTicks.map(t => <text key={`vt-${t}`} x={xFor(t)} y={chartH - marginB + 18} className="chart-tick-x" textAnchor="middle">{t.toFixed(1)}</text>)}
        {depthTicks.map(d => <text key={`ht-${d}`} x={marginL - 8} y={yFor(d) + 3} className="chart-tick-y" textAnchor="end">{d}m</text>)}
      </svg>
      <div className="chart-legend">
        <span><i className="legend-swatch bob" /> BAY OF BENGAL</span>
        <span><i className="legend-swatch as" /> ARABIAN SEA</span>
      </div>
    </div>
  );
}

function DepthMetricReadout({ depth }: { depth: number }) {
  const bob = BOB_DEPTH_METRICS.find(p => p.depth === depth);
  const as = ARABIAN_SEA_DEPTH_METRICS.find(p => p.depth === depth);
  return (
    <div className="depth-readout">
      <div className="depth-readout-card">
        <span className="panel-kicker">BAY OF BENGAL · {depth} m</span>
        <div className="readout-values">
          <div><span>RMSE</span><strong>{bob ? `${bob.rmse.toFixed(3)}°C` : "—"}</strong></div>
          <div><span>CORRELATION</span><strong>{bob ? bob.corr.toFixed(3) : "—"}</strong></div>
        </div>
      </div>
      <div className="depth-readout-card">
        <span className="panel-kicker">ARABIAN SEA · {depth} m</span>
        <div className="readout-values">
          <div><span>RMSE</span><strong>{as ? `${as.rmse.toFixed(3)}°C` : "—"}</strong></div>
          <div><span>CORRELATION</span><strong>{as ? as.corr.toFixed(3) : "—"}</strong></div>
        </div>
      </div>
    </div>
  );
}

function ArgoValidationSummary() {
  return (
    <div className="argo-plot" aria-label="Independent ARGO validation summary">
      <div className="plot-grid ocean-grid" />
      <span className="map-label label-north">30°N</span>
      <span className="map-label label-south">5°N</span>
      <span className="map-label label-west">45°E</span>
      <span className="map-label label-east">105°E</span>
      <div className="argo-summary">
        <div className="argo-summary-card">
          <span className="panel-kicker">BAY OF BENGAL</span>
          <strong>{formatCount(REGION_SUMMARY["BAY OF BENGAL"].n)} ARGO MEASUREMENTS</strong>
          <div className="argo-summary-metrics"><span>RMSE <b>0.637°C</b></span><span>CORRELATION <b>0.997</b></span></div>
        </div>
        <div className="argo-summary-card">
          <span className="panel-kicker">ARABIAN SEA</span>
          <strong>{formatCount(REGION_SUMMARY["ARABIAN SEA"].n)} ARGO MEASUREMENTS</strong>
          <div className="argo-summary-metrics"><span>RMSE <b>0.834°C</b></span><span>CORRELATION <b>0.988</b></span></div>
        </div>
      </div>
    </div>
  );
}

function DataProvenanceTable() {
  return (
    <div className="table-wrap"><table><thead><tr><th>ROLE</th><th>DATASET</th><th>PURPOSE</th></tr></thead><tbody>
      <tr><td><b className="role-target">MODEL TRAINING TARGET</b></td><td>GLORYS Global Ocean Reanalysis</td><td>Reference subsurface temperature field</td></tr>
      <tr><td><b className="role-validation">INDEPENDENT VALIDATION</b></td><td>Gridded ARGO / INCOIS</td><td>Independent in-situ validation</td></tr>
      {["Satellite SST", "Satellite / observation SSS", "Satellite / observation SSH / SLA", "Ocean current product", "Atmospheric analysis"].map(dataset => <tr key={dataset}><td><b className="role-input">SURFACE INPUT</b></td><td>{dataset}</td><td>Model input</td></tr>)}
    </tbody></table></div>
  );
}

function ModelStatus() {
  return (
    <div className="status-panel"><div><div className="eyebrow">OCEANEMBED MODEL STATUS</div><h2>Two regional models<br /><em>trained and validated</em></h2></div><div className="status-list"><div><span>TRAINING</span><b className="active-status">COMPLETE — 2 REGIONAL MODELS</b></div><div><span>EVALUATION</span><b className="active-status">COMPLETE — VS. GLORYS + ARGO</b></div><div><span>ARGO VALIDATION</span><b className="active-status">COMPLETE — 2,159,612 MEASUREMENTS</b></div><div><span>DEPLOYMENT</span><b className="active-status">5 VALIDATED PREDICTIONS LIVE ON /SOLUTION</b></div></div></div>
  );
}

export default function TechnologyPage() {
  const [selectedDepth, setSelectedDepth] = useState(0);
  const [region, setRegion] = useState("BAY OF BENGAL");
  const summary = REGION_SUMMARY[region];

  return (
    <div className="technology-page">
      <SiteNavbar />
      <main>
        <section className="tech-hero page-width">
          <div className="tech-hero-copy">
            <h1><span>FROM SURFACE</span><span>SIGNALS</span><em><span>TO SUBSURFACE</span><span>TEMPERATURE</span></em></h1>
            <p className="hero-lede">OceanEmbed reconstructs the vertical temperature structure of the North Indian Ocean from surface ocean observations alone.</p>
            <p className="hero-support">The model learns the relationship between daily surface ocean conditions and the subsurface temperature field represented by the training target. Evaluation is performed depth by depth and against independent ARGO observations to determine where the reconstruction is reliable and where uncertainty increases.</p>
            <div className="hero-meta"><span>REGION <b>5°N–30°N · 45°E–105°E</b></span><span>GRID <b>0.25° × 0.25° · DAILY</b></span><span>STATUS <b className="validated">VALIDATED — 2 REGIONAL MODELS</b></span></div>
          </div>
          <OceanEmbedHeroVisualization />
        </section>

        <section className="pipeline-section page-width">
          <SectionHeading title="MODEL PIPELINE">A complete workflow from surface data to validated subsurface temperature.</SectionHeading>
          <div className="pipeline" role="list">{pipeline.map((card, index) => <div className="pipeline-item" key={card.title} role="listitem"><PipelineFlashcard {...card} emphasized={index === 0} />{index < pipeline.length - 1 && <span className="pipeline-arrow" aria-hidden="true">→</span>}</div>)}</div>
          <div className="pipeline-progress" aria-hidden="true">{pipeline.map((card, index) => <span className={index === 0 ? "active" : ""} key={card.number} />)}</div>
          <div className="pipeline-meta"><div><span>REGION</span><b>5°N – 30°N, 45°E – 105°E</b></div><div><span>GRID</span><b>0.25° × 0.25°</b></div><div><span>TEMPORAL RESOLUTION</span><b>Daily</b></div></div>
        </section>

        <section className="dark-band">
          <div className="page-width">
            <SectionHeading title="WHAT THE MODEL SEES">The model receives surface ocean-state information and reconstructs temperature through the upper ocean and into deeper layers. The two regions&rsquo; final models use different surface inputs.</SectionHeading>
            <div className="input-target-grid">
              <div className="field-panel">
                <div className="panel-kicker">SURFACE INPUT</div>
                <div className="field-list">
                  {["SST", "SSH"].map((field, index) => <div key={field}><span>0{index + 1}</span>{field}<em>BOTH REGIONS</em></div>)}
                  {["WIND STRESS CURL", "MLD", "SSS", "EDDY VORTICITY"].map((field, index) => <div key={field}><span>0{index + 3}</span>{field}<em>ARABIAN SEA ONLY</em></div>)}
                </div>
                <p className="panel-note">Bay of Bengal&rsquo;s final model uses SST + SSH with 5-region clustering; Arabian Sea&rsquo;s adds four more surface fields with 10-region clustering — both with bias correction.</p>
              </div>
              <div className="field-connector"><span>DAILY<br />SURFACE<br />STATE</span><b>→</b></div>
              <div className="field-panel target-panel"><div className="panel-kicker">RECONSTRUCTION TARGET</div><div className="target-name">SUBSURFACE<br /><strong>TEMPERATURE</strong></div><div className="depth-list">{depths.map(depth => <span key={depth}>{depth} m</span>)}</div></div>
            </div>
          </div>
        </section>

        <section className="architecture-section page-width">
          <SectionHeading title="EMBEDDING ARCHITECTURE">OceanEmbed converts the multi-variable surface ocean state into a learned representation that can be used to reconstruct temperature at multiple depths.</SectionHeading>
          <div className="architecture-diagram">{["INPUT FIELDS", "FEATURE ENCODING", "OCEAN EMBEDDING", "DEPTH-AWARE DECODER", "TEMPERATURE PROFILE"].map((item, index) => <div className="architecture-node" key={item}><span>{String(index + 1).padStart(2, "0")}</span><strong>{item}</strong>{index < 4 && <b>→</b>}</div>)}</div>
          <div className="technical-note"><span>TECHNICAL NOTE</span> Architecture-specific details are reported from the trained model configuration.</div>
        </section>

        <section className="evaluation-section dark-band">
          <div className="page-width">
            <SectionHeading title="HOW THE MODEL IS EVALUATED">Evaluation is performed independently of training, using temperature fields and profiles withheld from the fitting process.</SectionHeading>
            <div className="metric-grid">{metrics.map(m => <MetricBlock key={m.short} {...m} />)}</div>
          </div>
        </section>

        <section className="chart-section page-width">
          <SectionHeading title="PERFORMANCE THROUGH THE WATER COLUMN">Validated RMSE by depth, against withheld ARGO profiles. Error peaks in the thermocline and falls again in deep water for both regions.</SectionHeading>
          <div className="chart-shell"><DepthRmseChart /></div>
          <div className="depth-scale">STANDARD DEPTHS <span>{depths.map(depth => <b key={depth}>{depth} m</b>)}</span></div>
        </section>

        <section className="chart-section dark-band">
          <div className="page-width">
            <SectionHeading title="RMSE & CORRELATION BY DEPTH">A depth-selectable readout of validated RMSE and correlation for both regions.</SectionHeading>
            <div className="chart-controls"><span>DEPTH SELECTOR</span>{evaluationDepths.map(depth => <button key={depth} className={selectedDepth === depth ? "selected" : ""} onClick={() => setSelectedDepth(depth)}>{depth} m</button>)}</div>
            <div className="chart-shell"><DepthMetricReadout depth={selectedDepth} /></div>
          </div>
        </section>

        <section className="argo-section page-width">
          <SectionHeading title="INDEPENDENT ARGO VALIDATION">ARGO observations provide an independent reference for assessing whether reconstructed subsurface temperature fields remain physically consistent outside the training target.</SectionHeading>
          <div className="validation-flow"><div>MODEL<br /><strong>PREDICTION</strong></div><b>+</b><div>ARGO<br /><strong>PROFILE</strong></div><b>↓</b><div>DEPTH-MATCHED<br /><strong>COMPARISON</strong></div><b>↓</b><div>RMSE / BIAS /<br /><strong>CORRELATION</strong></div></div>
          <ArgoValidationSummary />
        </section>

        <section className="regional-section dark-band"><div className="page-width"><SectionHeading title="WHERE THE MODEL PERFORMS">Regional comparisons distinguish reconstruction behavior across the two proof-of-concept regions.</SectionHeading><div className="region-tabs">{["BAY OF BENGAL", "ARABIAN SEA"].map(item => <button key={item} className={region === item ? "selected" : ""} onClick={() => setRegion(item)}>{item}</button>)}</div><div className="region-panel"><div><span className="panel-kicker">ACTIVE REGION</span><h3>{region}</h3><p>Final model: {summary.inputs.join(", ")} · {summary.clusters}-region clustering + bias correction.</p></div><div className="region-metrics"><div><span>RMSE</span><strong>{summary.rmse.toFixed(3)}°C</strong></div><div><span>BIAS</span><strong>—</strong><small>NOT REPORTED</small></div><div><span>CORRELATION</span><strong>{summary.correlation.toFixed(3)}</strong></div><div><span>ARGO VALIDATION COUNT</span><strong>{formatCount(summary.n)}</strong></div></div></div></div></section>

        <section className="uncertainty-section page-width"><SectionHeading title="UNDERSTANDING MODEL ERROR">Reconstruction skill is not uniform with depth or location. Validation against ARGO shows:</SectionHeading><div className="uncertainty-list">{uncertaintyFindings.map((item, index) => <div key={item}><span>0{index + 1}</span>{item}</div>)}</div></section>

        <section className="provenance-section dark-band"><div className="page-width"><SectionHeading title="DATA USED FOR EVALUATION">The evaluation design separates the model training target, independent validation, and surface input fields.</SectionHeading><DataProvenanceTable /></div></section>

        <section className="status-section page-width"><ModelStatus /></section>
      </main>
      <Footer />
      <style>{styles}</style>
    </div>
  );
}

const styles = `
  .technology-page { min-height: 100vh; background: linear-gradient(180deg, #78CBE9 0%, #3bb3cb 12%, #15799e 29%, #083c61 50%, #031124 73%, #01070e 100%); color: #eaf7ff; font-family: var(--font-public-sans), sans-serif; }
  .technology-page main { padding-top: 70px; overflow: hidden; }
  .page-width { width: min(1240px, calc(100% - 3rem)); margin: 0 auto; }
  .tech-hero { min-height: calc(100vh - 70px); box-sizing: border-box; padding: 1.5rem 0 2rem; display: grid; grid-template-columns: minmax(0, 1.02fr) minmax(0, .98fr); align-items: center; gap: clamp(2rem, 5vw, 5rem); }
  .tech-hero-copy { min-width: 0; }
  .eyebrow, .panel-kicker, .metric-code, .hero-meta, .depth-scale, .chart-controls, th, .role-target, .role-validation, .role-input, .status-list span { color: #7ce0d0; font: 600 .67rem/1.3 var(--font-public-sans), sans-serif; letter-spacing: .14em; }
  h1, h2, h3, p { margin: 0; }
  h1, h2, h3 { font-family: var(--font-space-grotesk), sans-serif; }
  h1 { max-width: 950px; margin: 0; color: #fff; font-size: clamp(4.5rem, 5.2vw, 5.4rem); line-height: .91; letter-spacing: 0; font-weight: 600; }
  h1 > span, h1 em > span { display: block; }
  h1 > span { color: #fff; -webkit-text-fill-color: #fff; -webkit-text-stroke: 0; text-stroke: 0; }
  h1 em { color: transparent; -webkit-text-fill-color: transparent; -webkit-text-stroke: 1.5px #fff; text-stroke: 1.5px #fff; }
  h1 em, h2 em { color: #aee7f6; font-style: normal; }
  .hero-lede { max-width: 660px; margin-top: 1.35rem; color: #e4f7fc; font: 500 1.02rem/1.42 var(--font-space-grotesk), sans-serif; }
  .hero-support { max-width: 680px; margin-top: .75rem; color: rgba(222, 244, 252, .72); font-size: .81rem; line-height: 1.55; }
  .hero-meta { display: flex; flex-wrap: wrap; gap: 1.1rem 1.5rem; margin-top: 1.65rem; color: rgba(174, 231, 246, .65); }
  .hero-meta b { color: #eaf7ff; margin-left: .45rem; letter-spacing: .06em; font-weight: 500; }
  .validated { color: #7ce0d0 !important; }
  .hero-visual { width: 100%; max-width: 560px; justify-self: end; }
  .hero-visual svg { display: block; width: 100%; height: auto; overflow: visible; }
  .hero-visual-labels text, .observation-line text, .depth-label, .reconstruction-label text { fill: #eaf7ff; font: 600 9px var(--font-public-sans), sans-serif; letter-spacing: 1.5px; }
  .hero-visual-labels .visual-muted, .visual-muted { fill: rgba(174, 231, 246, .56); font-size: 7px; letter-spacing: 1.2px; }
  .observation-line path, .observation-line circle, .depth-tick, .reconstruction-label line { fill: none; stroke: rgba(174, 231, 246, .7); stroke-width: 1; }
  .observation-line circle { fill: #7ce0d0; stroke: #dffaff; stroke-width: .7; animation: observationPulse 3.6s ease-in-out infinite; }
  .observation-line circle:nth-of-type(2) { animation-delay: .5s; }.observation-line circle:nth-of-type(3) { animation-delay: 1s; }.observation-line circle:nth-of-type(4) { animation-delay: 1.5s; }.observation-line circle:nth-of-type(5) { animation-delay: 2s; }
  .observation-line text { fill: #7ce0d0; font-size: 7px; letter-spacing: 1px; }
  .data-flow { fill: none; stroke: rgba(124, 224, 208, .78); stroke-width: 1.2; stroke-dasharray: 3 8; animation: dataFlow 5s linear infinite; }
  .flow-arrow { fill: none; stroke: #7ce0d0; stroke-width: 1.2; }.flow-label { fill: rgba(174, 231, 246, .62); font: 600 7px var(--font-public-sans), sans-serif; letter-spacing: 1px; }
  .depth-plane { opacity: 0; animation: planeReveal .7s ease forwards; }.depth-plane path:not(.contour) { stroke: rgba(174, 231, 246, .18); stroke-width: 1; }.contour { fill: none; stroke: rgba(174, 231, 246, .38); stroke-width: 1; stroke-dasharray: 2 5; }.contour-soft { opacity: .55; stroke-dasharray: 1 6; }.depth-tick { stroke: rgba(174, 231, 246, .42); }.depth-label { fill: rgba(234, 247, 255, .72); font-size: 8px; letter-spacing: 1px; }
  @keyframes observationPulse { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }.data-flow { stroke-dashoffset: 0; } @keyframes dataFlow { to { stroke-dashoffset: -44; } } @keyframes planeReveal { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
  section { padding: 7rem 0; }
  .section-heading { max-width: 800px; margin-bottom: 3.25rem; }
  .section-heading h2 { margin-top: .7rem; color: #fff; font-size: clamp(2rem, 4vw, 3.6rem); line-height: 1.02; font-weight: 600; }
  .section-heading p { max-width: 720px; margin-top: 1.2rem; color: rgba(222, 244, 252, .7); line-height: 1.7; font-size: .96rem; }
  .pipeline { display: grid; grid-template-columns: repeat(6, minmax(0, 1fr)); gap: .7rem; }
  .pipeline-item { position: relative; min-width: 0; }
  .pipeline-card { min-height: 278px; display: flex; flex-direction: column; padding: 1.25rem 1.1rem 1.1rem; background: rgba(5, 39, 63, .58); border: 1px solid rgba(174, 231, 246, .18); border-radius: 4px; box-shadow: 0 10px 24px rgba(1, 7, 14, .14); backdrop-filter: blur(10px); transition: transform .22s ease, border-color .22s ease, background-color .22s ease; }
  .pipeline-card:hover { transform: translateY(-4px); background: rgba(7, 54, 78, .74); border-color: rgba(174, 231, 246, .42); }
  .pipeline-card.emphasized { border-color: rgba(124, 224, 208, .52); }
  .step-number { color: #7ce0d0; font: 600 .75rem var(--font-space-grotesk), sans-serif; }
  .pipeline-card h3 { min-height: 3.1rem; margin-top: 2.3rem; color: #fff; font-size: .86rem; line-height: 1.25; letter-spacing: .07em; font-weight: 600; }
  .pipeline-card p { margin-top: .9rem; color: rgba(222, 244, 252, .67); font-size: .78rem; line-height: 1.55; }
  .card-tags { display: flex; flex-wrap: wrap; gap: .35rem; margin-top: auto; padding-top: 1.1rem; }
  .card-tags span { padding: .28rem .34rem; border: 1px solid rgba(174, 231, 246, .2); color: rgba(174, 231, 246, .74); font: 600 .55rem var(--font-public-sans), sans-serif; letter-spacing: .05em; }
  .pipeline-arrow { position: absolute; top: 50%; right: -.9rem; z-index: 2; color: rgba(124, 224, 208, .7); font-size: .95rem; transform: translateY(-50%); }
  .pipeline-progress { display: none; }
  .pipeline-meta { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 2rem; margin-top: 1.35rem; padding-top: 1rem; border-top: 1px solid rgba(174, 231, 246, .18); }
  .pipeline-meta div { display: flex; flex-direction: column; gap: .35rem; }
  .pipeline-meta span { color: #7ce0d0; font: 600 .62rem var(--font-public-sans), sans-serif; letter-spacing: .12em; }
  .pipeline-meta b { color: rgba(234, 247, 255, .78); font: 500 .78rem var(--font-space-grotesk), sans-serif; letter-spacing: .02em; }
  .dark-band { background: transparent; border-top: 1px solid rgba(174, 231, 246, .09); border-bottom: 1px solid rgba(174, 231, 246, .09); }
  .input-target-grid { display: grid; grid-template-columns: 1fr 130px 1fr; align-items: stretch; gap: 1.5rem; }
  .field-panel { padding: 1.5rem; background: rgba(1, 9, 18, .42); border: 1px solid rgba(174, 231, 246, .18); }
  .field-list { margin-top: 1.4rem; border-top: 1px solid rgba(174, 231, 246, .14); }
  .field-list div { display: flex; gap: 1rem; align-items: center; padding: .78rem 0; border-bottom: 1px solid rgba(174, 231, 246, .1); color: #eaf7ff; font: 500 .82rem var(--font-space-grotesk), sans-serif; letter-spacing: .06em; }
  .field-list span { width: 22px; color: #7ce0d0; font-size: .68rem; }
  .field-list em { margin-left: auto; font-style: normal; font-size: .58rem; letter-spacing: .08em; color: rgba(174, 231, 246, .5); white-space: nowrap; }
  .panel-note { margin-top: 1.4rem; color: rgba(222, 244, 252, .58); font-size: .78rem; line-height: 1.5; }
  .field-connector { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem; color: #7ce0d0; text-align: center; font: 600 .6rem/1.4 var(--font-public-sans), sans-serif; letter-spacing: .12em; }
  .field-connector b { font-size: 2rem; font-weight: 400; }
  .target-name { margin-top: 3rem; color: #aee7f6; font: 500 1.5rem/1.15 var(--font-space-grotesk), sans-serif; }
  .target-name strong { color: #fff; font-weight: 600; }
  .depth-list { display: flex; flex-wrap: wrap; gap: .45rem; margin-top: 3rem; }
  .depth-list span { padding: .42rem .55rem; border: 1px solid rgba(174, 231, 246, .16); color: rgba(222, 244, 252, .72); font-size: .68rem; }
  .architecture-diagram { display: grid; grid-template-columns: repeat(5, 1fr); border: 1px solid rgba(174, 231, 246, .2); }
  .architecture-node { position: relative; min-height: 135px; display: flex; flex-direction: column; justify-content: center; gap: .8rem; padding: 1rem; border-right: 1px solid rgba(174, 231, 246, .16); }
  .architecture-node:last-child { border-right: 0; }
  .architecture-node span { color: #7ce0d0; font: .7rem var(--font-space-grotesk), sans-serif; }
  .architecture-node strong { max-width: 130px; color: #fff; font: 600 .8rem/1.35 var(--font-space-grotesk), sans-serif; letter-spacing: .08em; }
  .architecture-node b { position: absolute; top: 50%; right: -.55rem; z-index: 1; padding: 0 .25rem; color: #7ce0d0; background: #0a3854; font-size: 1.2rem; font-weight: 400; }
  .technical-note { margin-top: 1.2rem; color: rgba(222, 244, 252, .55); font-size: .78rem; }
  .technical-note span { margin-right: .8rem; color: #7ce0d0; font: 600 .63rem var(--font-public-sans), sans-serif; letter-spacing: .12em; }
  .metric-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: rgba(174, 231, 246, .16); border: 1px solid rgba(174, 231, 246, .16); }
  .metric-block { min-height: 250px; padding: 1.4rem; background: #06213a; }
  .metric-block h3 { margin-top: .8rem; color: #eaf7ff; font-size: 1.02rem; font-weight: 500; }
  .metric-block p { min-height: 76px; margin-top: .8rem; color: rgba(222, 244, 252, .6); font-size: .8rem; line-height: 1.55; }
  .metric-value { margin-top: 1rem; color: rgba(234, 247, 255, .9); font: 500 2rem var(--font-space-grotesk), sans-serif; }
  .metric-status { display: block; margin-top: .3rem; color: rgba(243, 201, 139, .8); font-size: .57rem; letter-spacing: .08em; }
  .metric-values { display: flex; flex-direction: column; gap: .5rem; margin-top: 1rem; }
  .metric-values div { display: flex; align-items: baseline; justify-content: space-between; gap: .6rem; }
  .metric-values span { color: rgba(174, 231, 246, .6); font-size: .6rem; letter-spacing: .08em; }
  .metric-values strong { color: #7ce0d0; font: 500 1.15rem var(--font-space-grotesk), sans-serif; }
  .chart-shell { padding: 1.5rem; border: 1px solid rgba(174, 231, 246, .18); background: rgba(1, 9, 18, .38); }
  .depth-rmse-chart { display: flex; flex-direction: column; gap: 1rem; }
  .depth-rmse-chart svg { display: block; width: 100%; height: auto; }
  .chart-grid-line { stroke: rgba(174, 231, 246, .12); stroke-width: 1; }
  .chart-line { fill: none; stroke-width: 2; }
  .bob-line, .bob-dot { stroke: #7ce0d0; }
  .as-line, .as-dot { stroke: #f3c98b; }
  .bob-dot, .as-dot { fill: #06213a; stroke-width: 2; }
  .chart-tick-x, .chart-tick-y { fill: rgba(222, 244, 252, .55); font: .6rem var(--font-space-grotesk), sans-serif; }
  .chart-legend { display: flex; gap: 1.5rem; }
  .chart-legend span { display: flex; align-items: center; gap: .5rem; color: rgba(222, 244, 252, .7); font-size: .68rem; letter-spacing: .06em; }
  .legend-swatch { display: inline-block; width: 14px; height: 3px; border-radius: 2px; }
  .legend-swatch.bob { background: #7ce0d0; }
  .legend-swatch.as { background: #f3c98b; }
  .depth-readout { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; }
  .depth-readout-card { padding: 1.5rem; border: 1px solid rgba(174, 231, 246, .16); background: rgba(1, 9, 18, .3); }
  .readout-values { display: flex; gap: 2rem; margin-top: 1.2rem; }
  .readout-values div { display: flex; flex-direction: column; gap: .4rem; }
  .readout-values span { color: rgba(174, 231, 246, .6); font-size: .62rem; letter-spacing: .08em; }
  .readout-values strong { color: #fff; font: 500 1.6rem var(--font-space-grotesk), sans-serif; }
  .chart-controls { display: flex; align-items: center; flex-wrap: wrap; gap: .5rem; margin: -1rem 0 1.5rem; color: rgba(174, 231, 246, .68); }
  .chart-controls button, .region-tabs button { padding: .6rem .8rem; border: 1px solid rgba(174, 231, 246, .2); background: transparent; color: rgba(222, 244, 252, .7); font: 600 .64rem var(--font-public-sans), sans-serif; letter-spacing: .08em; cursor: pointer; }
  .chart-controls button.selected, .region-tabs button.selected { border-color: #7ce0d0; color: #061c2d; background: #7ce0d0; }
  .validation-flow { display: grid; grid-template-columns: 1fr auto 1fr auto 1.3fr auto 1.2fr; align-items: center; gap: 1rem; margin-bottom: 2rem; padding: 1.3rem; border-top: 1px solid rgba(174, 231, 246, .18); border-bottom: 1px solid rgba(174, 231, 246, .18); color: rgba(222, 244, 252, .7); text-align: center; font: 600 .68rem/1.4 var(--font-public-sans), sans-serif; letter-spacing: .12em; }
  .validation-flow strong { color: #fff; font-weight: 600; }
  .validation-flow b { color: #7ce0d0; font-size: 1.4rem; font-weight: 400; }
  .argo-plot { position: relative; min-height: 340px; overflow: hidden; border: 1px solid rgba(174, 231, 246, .18); background: #06213a; }
  .ocean-grid { opacity: .75; background-size: 8% 20%; }
  .map-label { position: absolute; z-index: 1; color: rgba(174, 231, 246, .5); font: .65rem var(--font-space-grotesk), sans-serif; }
  .label-north { top: 1rem; left: 1rem; }.label-south { bottom: 1rem; left: 1rem; }.label-west { bottom: 1rem; left: 15%; }.label-east { bottom: 1rem; right: 10%; }
  .argo-summary { position: absolute; inset: 0; z-index: 1; display: flex; align-items: center; justify-content: center; gap: 1.5rem; flex-wrap: wrap; padding: 1.5rem; }
  .argo-summary-card { padding: 1.5rem 1.75rem; border: 1px solid rgba(174, 231, 246, .22); background: rgba(1, 9, 18, .78); backdrop-filter: blur(6px); min-width: 220px; }
  .argo-summary-card strong { display: block; margin-top: .6rem; color: #fff; font: 500 1.15rem var(--font-space-grotesk), sans-serif; }
  .argo-summary-metrics { display: flex; gap: 1.2rem; margin-top: 1rem; }
  .argo-summary-metrics span { color: rgba(222, 244, 252, .6); font-size: .68rem; letter-spacing: .06em; }
  .argo-summary-metrics b { display: block; margin-top: .3rem; color: #7ce0d0; font: 500 1.1rem var(--font-space-grotesk), sans-serif; }
  .region-tabs { display: flex; gap: .5rem; margin-bottom: 1.5rem; }
  .region-panel { display: grid; grid-template-columns: 1fr 2fr; gap: 3rem; padding: 2rem; border: 1px solid rgba(174, 231, 246, .17); background: rgba(1, 9, 18, .4); }
  .region-panel h3 { margin-top: .7rem; color: #fff; font-size: 1.5rem; }.region-panel p { max-width: 280px; margin-top: .8rem; color: rgba(222, 244, 252, .58); font-size: .82rem; line-height: 1.55; }
  .region-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }.region-metrics div { display: flex; flex-direction: column; gap: .45rem; padding-left: 1rem; border-left: 1px solid rgba(174, 231, 246, .18); }.region-metrics span { color: rgba(174, 231, 246, .64); font-size: .63rem; letter-spacing: .1em; }.region-metrics strong { color: #fff; font: 1.5rem var(--font-space-grotesk), sans-serif; }.region-metrics small { color: #f3c98b; font-size: .58rem; letter-spacing: .08em; }
  .uncertainty-list { display: grid; grid-template-columns: repeat(5, 1fr); border-top: 1px solid rgba(174, 231, 246, .18); }.uncertainty-list div { min-height: 190px; padding: 1.2rem 1rem 1rem 0; border-right: 1px solid rgba(174, 231, 246, .14); color: rgba(222, 244, 252, .74); font: 500 .8rem/1.45 var(--font-space-grotesk), sans-serif; }.uncertainty-list div + div { padding-left: 1rem; }.uncertainty-list span { display: block; margin-bottom: 2rem; color: #7ce0d0; font-size: .68rem; }
  .table-wrap { overflow-x: auto; border: 1px solid rgba(174, 231, 246, .18); }.table-wrap table { width: 100%; min-width: 760px; border-collapse: collapse; text-align: left; }.table-wrap th, .table-wrap td { padding: 1.1rem 1rem; border-bottom: 1px solid rgba(174, 231, 246, .12); }.table-wrap th { color: #7ce0d0; font-size: .63rem; }.table-wrap td { color: rgba(222, 244, 252, .72); font-size: .83rem; }.table-wrap tr:last-child td { border-bottom: 0; }.role-target, .role-validation, .role-input { font-size: .6rem; letter-spacing: .08em; }.role-target { color: #f3c98b; }.role-validation { color: #c5a6ef; }.role-input { color: #7ce0d0; }
  .status-section { padding-bottom: 8rem; }.status-panel { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; padding: 2.2rem; border: 1px solid rgba(174, 231, 246, .22); background: rgba(1, 9, 18, .4); }.status-panel h2 { margin-top: .9rem; color: #fff; font-size: clamp(1.8rem, 4vw, 3.2rem); line-height: 1.02; }.status-list { border-top: 1px solid rgba(174, 231, 246, .17); }.status-list div { display: flex; justify-content: space-between; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid rgba(174, 231, 246, .12); }.status-list b { color: #f3c98b; font: 500 .65rem var(--font-space-grotesk), sans-serif; letter-spacing: .07em; text-align: right; }.status-list .active-status { color: #7ce0d0; }
  @media (max-width: 900px) { .tech-hero { min-height: 580px; padding-top: 2rem; grid-template-columns: minmax(0, 1fr) minmax(260px, .82fr); gap: 1.5rem; }.hero-visual { max-width: 420px; }.pipeline { display: flex; overflow-x: auto; gap: .8rem; padding: .3rem .2rem .8rem; scroll-snap-type: x mandatory; scrollbar-width: thin; }.pipeline-item { flex: 0 0 min(72vw, 260px); scroll-snap-align: start; }.pipeline-card { min-height: 265px; }.pipeline-arrow { display: none; }.pipeline-progress { display: flex; justify-content: center; gap: .35rem; margin-top: .7rem; }.pipeline-progress span { width: 18px; height: 2px; background: rgba(174, 231, 246, .25); }.pipeline-progress span.active { background: #7ce0d0; }.input-target-grid { grid-template-columns: 1fr; }.field-connector { flex-direction: row; padding: .5rem; }.field-connector b { transform: rotate(90deg); }.architecture-diagram { grid-template-columns: 1fr; }.architecture-node { min-height: 90px; border-right: 0; border-bottom: 1px solid rgba(174, 231, 246, .16); }.architecture-node:last-child { border-bottom: 0; }.architecture-node b { top: auto; right: 50%; bottom: -.65rem; transform: rotate(90deg); }.metric-grid { grid-template-columns: repeat(2, 1fr); }.region-panel, .status-panel { grid-template-columns: 1fr; gap: 2rem; }.uncertainty-list { grid-template-columns: repeat(2, 1fr); }.uncertainty-list div:nth-child(2n) { border-right: 0; }.depth-readout { grid-template-columns: 1fr; } }
  @media (max-width: 620px) { .page-width { width: min(100% - 2rem, 1240px); }.technology-page main { padding-top: 64px; }.tech-hero { min-height: auto; padding: 3.5rem 0 4rem; grid-template-columns: 1fr; gap: 2.5rem; align-items: start; }.hero-visual { max-width: 520px; justify-self: center; }.hero-meta { flex-direction: column; gap: .8rem; }.pipeline-meta { grid-template-columns: 1fr; gap: .8rem; }.metric-grid { grid-template-columns: 1fr; }.metric-block { min-height: 210px; }.validation-flow { grid-template-columns: 1fr; gap: .55rem; }.validation-flow b { transform: rotate(90deg); }.depth-scale { flex-direction: column; }.region-metrics { grid-template-columns: repeat(2, 1fr); row-gap: 1.2rem; }.uncertainty-list { grid-template-columns: 1fr; }.uncertainty-list div, .uncertainty-list div + div { min-height: auto; padding: 1rem 0; border-right: 0; }.uncertainty-list span { margin-bottom: .6rem; }.status-list div { flex-direction: column; gap: .45rem; }.status-list b { text-align: left; }.argo-summary { flex-direction: column; }.argo-summary-card { width: 100%; box-sizing: border-box; } }
`;
