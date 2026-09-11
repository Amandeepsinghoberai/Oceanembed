export default function ObservationGapDiagram() {
  return (
    <div className="data-svg gap-svg">
      <svg viewBox="0 0 900 270" role="img" aria-label="Surface observation gap in the subsurface ocean">
        <text className="svg-kicker" x="22" y="25">SURFACE OBSERVATION LAYER</text>
        <g className="gap-inputs"><text x="38" y="62">SST</text><text x="145" y="62">SSS</text><text x="252" y="62">SSH</text><text x="380" y="62">CURRENTS</text><text x="520" y="62">WINDS</text></g>
        <line className="svg-base" x1="22" y1="82" x2="878" y2="82" /><path className="svg-flow" d="M450 92 V128" /><path className="svg-arrow" d="M444 118 L450 128 L456 118" />
        <text className="svg-kicker" x="22" y="157">OBSERVATION LAYER</text><line className="svg-dotted" x1="22" y1="174" x2="878" y2="174" /><path className="svg-flow" d="M450 182 V211" /><path className="svg-arrow" d="M444 201 L450 211 L456 201" />
        <text className="svg-kicker" x="22" y="241">UNKNOWN / SPARSE SUBSURFACE</text><text className="svg-muted" x="680" y="241">0 m   50 m   100 m   200 m   500 m   1000 m</text>
      </svg>
    </div>
  );
}
