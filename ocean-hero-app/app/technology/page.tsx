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

const inputFields = ["SST", "SSS", "SSH / SLA", "U CURRENT", "V CURRENT", "U WIND", "V WIND"];
const depths = [0, 5, 10, 20, 30, 50, 75, 100, 125, 150, 200, 300, 500, 700, 1000];
const evaluationDepths = [0, 50, 100, 200, 500, 1000];
const metrics = [
  ["RMSE", "Root Mean Square Error", "Magnitude of reconstruction error between predicted and reference temperature."],
  ["BIAS", "Mean Prediction Error", "Whether the model systematically overestimates or underestimates temperature."],
  ["CORRELATION", "Pearson Correlation", "How closely predicted temperature variations follow the reference field."],
  ["MAE", "Mean Absolute Error", "The average absolute difference between prediction and reference."],
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

function MetricBlock({ short, title, text }: { short: string; title: string; text: string }) {
  return (
    <div className="metric-block">
      <div className="metric-code">{short}</div><h3>{title}</h3><p>{text}</p>
      <div className="metric-value">—</div><span className="metric-status">AWAITING TRAINED-MODEL EVALUATION</span>
    </div>
  );
}

function ScientificChartPlaceholder({ kind }: { kind: "depth" | "scatter" | "argo" }) {
  if (kind === "argo") {
    return (
      <div className="argo-plot" aria-label="ARGO validation locations pending">
        <div className="plot-grid ocean-grid" />
        <span className="map-label label-north">30°N</span>
        <span className="map-label label-south">5°N</span>
        <span className="map-label label-west">45°E</span>
        <span className="map-label label-east">105°E</span>
        <div className="empty-state"><strong>ARGO VALIDATION PENDING</strong><span>Independent validation results will appear after the trained model is tested against withheld ARGO observations.</span></div>
      </div>
    );
  }

  return (
    <div className={`scientific-plot ${kind}-plot`}>
      <div className="plot-y-axis">{kind === "depth" ? <><span>0</span><span>100</span><span>300</span><span>500</span><span>700</span><span>1000</span></> : <><span>40</span><span>30</span><span>20</span><span>10</span></>}</div>
      <div className="plot-body">
        <div className="plot-grid" />
        {kind === "depth" ? <div className="plot-x-ticks"><span>0</span><span>0.5</span><span>1.0</span><span>1.5</span><span>2.0</span></div> : <div className="one-to-one"><span>1:1 reference</span></div>}
        <div className="empty-state"><strong>{kind === "depth" ? "MODEL EVALUATION PENDING" : "NO EVALUATION RUN AVAILABLE"}</strong><span>{kind === "depth" ? "Depth-wise performance will appear here after the trained model is evaluated against the reference dataset." : "Predicted-versus-reference samples will appear after model evaluation."}</span></div>
      </div>
      <div className="plot-x-label">{kind === "depth" ? "RMSE (°C)" : "REFERENCE TEMPERATURE (°C)"}</div>
      {kind === "scatter" && <div className="plot-y-label">PREDICTED TEMPERATURE (°C)</div>}
      {kind === "depth" && <div className="plot-y-label">DEPTH (m)</div>}
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
    <div className="status-panel"><div><div className="eyebrow">OCEANEMBED MODEL STATUS</div><h2>Evaluation framework<br /><em>ready for results</em></h2></div><div className="status-list"><div><span>TRAINING</span><b>IN DEVELOPMENT</b></div><div><span>EVALUATION</span><b>PENDING TRAINED MODEL</b></div><div><span>ARGO VALIDATION</span><b>PENDING</b></div><div><span>DEPLOYMENT</span><b className="active-status">SURFACE DATA PIPELINE ACTIVE</b></div></div></div>
  );
}

export default function TechnologyPage() {
  const [selectedDepth, setSelectedDepth] = useState(0);
  const [region, setRegion] = useState("BAY OF BENGAL");

  return (
    <div className="technology-page">
      <SiteNavbar />
      <main>
        <section className="tech-hero page-width">
          <div className="tech-hero-copy">
            <h1><span>FROM SURFACE</span><span>SIGNALS</span><em><span>TO SUBSURFACE</span><span>TEMPERATURE</span></em></h1>
            <p className="hero-lede">OceanEmbed evaluates how reliably surface ocean observations can reconstruct the vertical temperature structure of the North Indian Ocean.</p>
            <p className="hero-support">The model learns the relationship between daily surface ocean conditions and the subsurface temperature field represented by the training target. Evaluation is performed depth by depth and against independent observations to determine where the reconstruction is reliable and where uncertainty increases.</p>
            <div className="hero-meta"><span>REGION <b>5°N–30°N · 45°E–105°E</b></span><span>GRID <b>0.25° × 0.25° · DAILY</b></span><span>STATUS <b className="pending">EVALUATION PENDING</b></span></div>
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
            <SectionHeading title="WHAT THE MODEL SEES">The model receives surface ocean-state information and reconstructs temperature through the upper ocean and into deeper layers.</SectionHeading>
            <div className="input-target-grid">
              <div className="field-panel"><div className="panel-kicker">SURFACE INPUT</div><div className="field-list">{inputFields.map((field, index) => <div key={field}><span>0{index + 1}</span>{field}</div>)}</div><p className="panel-note">Harmonized to the standardized OceanEmbed grid before entering the model.</p></div>
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
            <div className="metric-grid">{metrics.map(([short, title, text]) => <MetricBlock key={short} short={short} title={title} text={text} />)}</div>
          </div>
        </section>

        <section className="chart-section page-width">
          <SectionHeading title="PERFORMANCE THROUGH THE WATER COLUMN">Depth-wise error is expected to vary as surface constraints weaken with depth. No curve is shown until real evaluation output is available.</SectionHeading>
          <div className="chart-shell"><ScientificChartPlaceholder kind="depth" /></div>
          <div className="depth-scale">STANDARD DEPTHS <span>{depths.map(depth => <b key={depth}>{depth} m</b>)}</span></div>
        </section>

        <section className="chart-section dark-band">
          <div className="page-width">
            <SectionHeading title="PREDICTION VS REFERENCE">A depth-selectable comparison of reconstructed and reference temperatures.</SectionHeading>
            <div className="chart-controls"><span>DEPTH SELECTOR</span>{evaluationDepths.map(depth => <button key={depth} className={selectedDepth === depth ? "selected" : ""} onClick={() => setSelectedDepth(depth)}>{depth} m</button>)}</div>
            <div className="chart-shell"><ScientificChartPlaceholder kind="scatter" /></div>
          </div>
        </section>

        <section className="argo-section page-width">
          <SectionHeading title="INDEPENDENT ARGO VALIDATION">ARGO observations provide an independent reference for assessing whether reconstructed subsurface temperature fields remain physically consistent outside the training target.</SectionHeading>
          <div className="validation-flow"><div>MODEL<br /><strong>PREDICTION</strong></div><b>+</b><div>ARGO<br /><strong>PROFILE</strong></div><b>↓</b><div>DEPTH-MATCHED<br /><strong>COMPARISON</strong></div><b>↓</b><div>RMSE / BIAS /<br /><strong>CORRELATION</strong></div></div>
          <ScientificChartPlaceholder kind="argo" />
        </section>

        <section className="regional-section dark-band"><div className="page-width"><SectionHeading title="WHERE THE MODEL PERFORMS">Regional comparisons will distinguish reconstruction behavior across the intended proof-of-concept areas.</SectionHeading><div className="region-tabs">{["BAY OF BENGAL", "ARABIAN SEA"].map(item => <button key={item} className={region === item ? "selected" : ""} onClick={() => setRegion(item)}>{item}</button>)}</div><div className="region-panel"><div><span className="panel-kicker">ACTIVE REGION</span><h3>{region}</h3><p>Regional evaluation results will populate after model training and withheld-profile testing.</p></div><div className="region-metrics">{["RMSE", "BIAS", "CORRELATION", "ARGO VALIDATION COUNT"].map(item => <div key={item}><span>{item}</span><strong>—</strong><small>PENDING</small></div>)}</div></div></div></section>

        <section className="uncertainty-section page-width"><SectionHeading title="UNDERSTANDING MODEL ERROR">Reconstruction skill is not expected to be uniform with depth or location. Evaluation will identify:</SectionHeading><div className="uncertainty-list">{["Depths where surface observations strongly constrain subsurface temperature", "Regions with larger reconstruction errors", "Systematic warm or cold bias", "Degradation of skill with increasing depth", "Differences between the Arabian Sea and Bay of Bengal"].map((item, index) => <div key={item}><span>0{index + 1}</span>{item}</div>)}</div></section>

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
  .pending { color: #f3c98b !important; }
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
  .chart-shell { padding: 1.5rem; border: 1px solid rgba(174, 231, 246, .18); background: rgba(1, 9, 18, .38); }
  .scientific-plot { position: relative; min-height: 410px; display: flex; padding: 1.5rem 1.5rem 3rem 3.1rem; }
  .plot-y-axis { position: absolute; top: 1.5rem; bottom: 3rem; left: 0; display: flex; flex-direction: column; justify-content: space-between; color: rgba(222, 244, 252, .52); font: .68rem var(--font-space-grotesk), sans-serif; }
  .plot-body { position: relative; flex: 1; border-left: 1px solid rgba(174, 231, 246, .4); border-bottom: 1px solid rgba(174, 231, 246, .4); }
  .plot-grid { position: absolute; inset: 0; background-image: linear-gradient(rgba(174, 231, 246, .11) 1px, transparent 1px), linear-gradient(90deg, rgba(174, 231, 246, .11) 1px, transparent 1px); background-size: 20% 20%; }
  .plot-x-ticks { position: absolute; left: 0; right: 0; bottom: -1.4rem; display: flex; justify-content: space-between; color: rgba(222, 244, 252, .52); font: .68rem var(--font-space-grotesk), sans-serif; }
  .plot-x-label, .plot-y-label { position: absolute; color: #7ce0d0; font: 600 .62rem var(--font-public-sans), sans-serif; letter-spacing: .12em; }
  .plot-x-label { bottom: .3rem; left: 50%; transform: translateX(-50%); }
  .plot-y-label { top: 50%; left: -1.2rem; transform: rotate(-90deg) translateX(-50%); transform-origin: left top; }
  .one-to-one { position: absolute; left: 0; bottom: 0; width: 100%; height: 100%; overflow: hidden; }
  .one-to-one::after { content: ""; position: absolute; left: -10%; bottom: -1px; width: 120%; height: 1px; background: rgba(124, 224, 208, .65); transform: rotate(-35deg); transform-origin: left center; }
  .one-to-one span { position: absolute; top: 18%; right: 8%; color: rgba(124, 224, 208, .6); font-size: .68rem; }
  .empty-state { position: absolute; inset: 0; z-index: 1; display: flex; align-items: center; justify-content: center; flex-direction: column; gap: .6rem; padding: 1rem; text-align: center; }
  .empty-state strong { color: #aee7f6; font: 600 .76rem var(--font-space-grotesk), sans-serif; letter-spacing: .12em; }
  .empty-state span { max-width: 360px; color: rgba(222, 244, 252, .55); font-size: .75rem; line-height: 1.55; }
  .depth-scale { display: flex; gap: 1rem; margin-top: 1.2rem; color: rgba(174, 231, 246, .6); }
  .depth-scale span { display: flex; flex-wrap: wrap; gap: .55rem 1rem; color: rgba(222, 244, 252, .55); font-weight: 400; letter-spacing: .02em; }
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
  .region-tabs { display: flex; gap: .5rem; margin-bottom: 1.5rem; }
  .region-panel { display: grid; grid-template-columns: 1fr 2fr; gap: 3rem; padding: 2rem; border: 1px solid rgba(174, 231, 246, .17); background: rgba(1, 9, 18, .4); }
  .region-panel h3 { margin-top: .7rem; color: #fff; font-size: 1.5rem; }.region-panel p { max-width: 280px; margin-top: .8rem; color: rgba(222, 244, 252, .58); font-size: .82rem; line-height: 1.55; }
  .region-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; }.region-metrics div { display: flex; flex-direction: column; gap: .45rem; padding-left: 1rem; border-left: 1px solid rgba(174, 231, 246, .18); }.region-metrics span { color: rgba(174, 231, 246, .64); font-size: .63rem; letter-spacing: .1em; }.region-metrics strong { color: #fff; font: 1.5rem var(--font-space-grotesk), sans-serif; }.region-metrics small { color: #f3c98b; font-size: .58rem; letter-spacing: .08em; }
  .uncertainty-list { display: grid; grid-template-columns: repeat(5, 1fr); border-top: 1px solid rgba(174, 231, 246, .18); }.uncertainty-list div { min-height: 150px; padding: 1.2rem 1rem 1rem 0; border-right: 1px solid rgba(174, 231, 246, .14); color: rgba(222, 244, 252, .74); font: 500 .87rem/1.45 var(--font-space-grotesk), sans-serif; }.uncertainty-list div + div { padding-left: 1rem; }.uncertainty-list span { display: block; margin-bottom: 2rem; color: #7ce0d0; font-size: .68rem; }
  .table-wrap { overflow-x: auto; border: 1px solid rgba(174, 231, 246, .18); }.table-wrap table { width: 100%; min-width: 760px; border-collapse: collapse; text-align: left; }.table-wrap th, .table-wrap td { padding: 1.1rem 1rem; border-bottom: 1px solid rgba(174, 231, 246, .12); }.table-wrap th { color: #7ce0d0; font-size: .63rem; }.table-wrap td { color: rgba(222, 244, 252, .72); font-size: .83rem; }.table-wrap tr:last-child td { border-bottom: 0; }.role-target, .role-validation, .role-input { font-size: .6rem; letter-spacing: .08em; }.role-target { color: #f3c98b; }.role-validation { color: #c5a6ef; }.role-input { color: #7ce0d0; }
  .status-section { padding-bottom: 8rem; }.status-panel { display: grid; grid-template-columns: 1fr 1fr; gap: 4rem; padding: 2.2rem; border: 1px solid rgba(174, 231, 246, .22); background: rgba(1, 9, 18, .4); }.status-panel h2 { margin-top: .9rem; color: #fff; font-size: clamp(1.8rem, 4vw, 3.2rem); line-height: 1.02; }.status-list { border-top: 1px solid rgba(174, 231, 246, .17); }.status-list div { display: flex; justify-content: space-between; gap: 1rem; padding: 1rem 0; border-bottom: 1px solid rgba(174, 231, 246, .12); }.status-list b { color: #f3c98b; font: 500 .65rem var(--font-space-grotesk), sans-serif; letter-spacing: .07em; text-align: right; }.status-list .active-status { color: #7ce0d0; }
  @media (max-width: 900px) { .tech-hero { min-height: 580px; padding-top: 2rem; grid-template-columns: minmax(0, 1fr) minmax(260px, .82fr); gap: 1.5rem; }.hero-visual { max-width: 420px; }.pipeline { display: flex; overflow-x: auto; gap: .8rem; padding: .3rem .2rem .8rem; scroll-snap-type: x mandatory; scrollbar-width: thin; }.pipeline-item { flex: 0 0 min(72vw, 260px); scroll-snap-align: start; }.pipeline-card { min-height: 265px; }.pipeline-arrow { display: none; }.pipeline-progress { display: flex; justify-content: center; gap: .35rem; margin-top: .7rem; }.pipeline-progress span { width: 18px; height: 2px; background: rgba(174, 231, 246, .25); }.pipeline-progress span.active { background: #7ce0d0; }.input-target-grid { grid-template-columns: 1fr; }.field-connector { flex-direction: row; padding: .5rem; }.field-connector b { transform: rotate(90deg); }.architecture-diagram { grid-template-columns: 1fr; }.architecture-node { min-height: 90px; border-right: 0; border-bottom: 1px solid rgba(174, 231, 246, .16); }.architecture-node:last-child { border-bottom: 0; }.architecture-node b { top: auto; right: 50%; bottom: -.65rem; transform: rotate(90deg); }.metric-grid { grid-template-columns: repeat(2, 1fr); }.region-panel, .status-panel { grid-template-columns: 1fr; gap: 2rem; }.uncertainty-list { grid-template-columns: repeat(2, 1fr); }.uncertainty-list div:nth-child(2n) { border-right: 0; } }
  @media (max-width: 620px) { .page-width { width: min(100% - 2rem, 1240px); }.technology-page main { padding-top: 64px; }.tech-hero { min-height: auto; padding: 3.5rem 0 4rem; grid-template-columns: 1fr; gap: 2.5rem; align-items: start; }.hero-visual { max-width: 520px; justify-self: center; }.hero-meta { flex-direction: column; gap: .8rem; }.pipeline-meta { grid-template-columns: 1fr; gap: .8rem; }.metric-grid { grid-template-columns: 1fr; }.metric-block { min-height: 210px; }.validation-flow { grid-template-columns: 1fr; gap: .55rem; }.validation-flow b { transform: rotate(90deg); }.scientific-plot { min-height: 330px; padding-left: 2.7rem; }.depth-scale { flex-direction: column; }.region-metrics { grid-template-columns: repeat(2, 1fr); row-gap: 1.2rem; }.uncertainty-list { grid-template-columns: 1fr; }.uncertainty-list div, .uncertainty-list div + div { min-height: auto; padding: 1rem 0; border-right: 0; }.uncertainty-list span { margin-bottom: .6rem; }.status-list div { flex-direction: column; gap: .45rem; }.status-list b { text-align: left; } }
`;
