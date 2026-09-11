export default function OceanDepthDiagram() {
  const depths = ["0 m", "50 m", "100 m", "200 m", "500 m", "1000 m"];
  return (
    <div className="data-svg data-depth-svg">
      <svg viewBox="0 0 560 520" role="img" aria-label="Surface observations flowing into subsurface ocean structure">
        <defs>
          <linearGradient id="aboutSurface" x1="0" x2="1"><stop stopColor="#2a9db3" stopOpacity=".78" /><stop offset="1" stopColor="#0d527a" stopOpacity=".4" /></linearGradient>
          <linearGradient id="aboutDeep" x1="0" x2="1"><stop stopColor="#0e5874" stopOpacity=".45" /><stop offset="1" stopColor="#03172b" stopOpacity=".7" /></linearGradient>
        </defs>
        <text className="svg-kicker" x="30" y="30">SATELLITES / OBSERVATIONS</text>
        <text className="svg-muted" x="30" y="50">OBSERVED SURFACE STATE</text>
        <path className="svg-flow" d="M280 74 V454" />
        <path className="svg-arrow" d="M274 443 L280 454 L286 443" />
        <text className="svg-flow-label" x="294" y="118">OCEAN STATE</text>
        <g className="surface-dots"><circle cx="100" cy="77" r="4" /><circle cx="180" cy="77" r="4" /><circle cx="280" cy="77" r="4" /><circle cx="380" cy="77" r="4" /><circle cx="460" cy="77" r="4" /></g>
        <text className="svg-tag" x="84" y="101">SST</text><text className="svg-tag" x="166" y="101">SSS</text><text className="svg-tag" x="260" y="101">SSH</text><text className="svg-tag" x="346" y="101">CURRENTS</text><text className="svg-tag" x="452" y="101">WINDS</text>
        {depths.map((depth, index) => { const y = 150 + index * 55; return <g className="depth-layer" style={{ animationDelay: `${index * 80}ms` }} key={depth}><path d={`M72 ${y} C150 ${y - 16}, 222 ${y + 15}, 298 ${y} S430 ${y - 15}, 490 ${y + 2} L490 ${y + 35} C408 ${y + 48}, 350 ${y + 22}, 280 ${y + 38} S145 ${y + 48}, 72 ${y + 32} Z`} fill={index === 0 ? "url(#aboutSurface)" : "url(#aboutDeep)"} /><path className="svg-contour" d={`M90 ${y + 12} C166 ${y - 2}, 226 ${y + 26}, 302 ${y + 10} S420 ${y + 1}, 476 ${y + 18}`} /><line className="svg-tick" x1="490" y1={y + 18} x2="512" y2={y + 18} /><text className="svg-depth-label" x="520" y={y + 22}>{depth}</text></g>; })}
        <line className="svg-base" x1="72" y1="482" x2="490" y2="482" /><text className="svg-kicker" x="72" y="506">SUBSURFACE TEMPERATURE</text>
      </svg>
    </div>
  );
}
