export default function OceanEmbedHeroVisualization() {
  const planes = [
    { y: 150, label: "0 m", fill: "url(#surfacePlane)" },
    { y: 205, label: "50 m", fill: "url(#upperPlane)" },
    { y: 260, label: "100 m", fill: "url(#midPlane)" },
    { y: 315, label: "200 m", fill: "url(#deepPlane)" },
    { y: 370, label: "500 m", fill: "url(#lowerPlane)" },
    { y: 425, label: "1000 m", fill: "url(#bottomPlane)" },
  ];

  return (
    <div className="hero-visual" aria-label="Conceptual surface-to-subsurface temperature reconstruction diagram">
      <svg viewBox="0 0 560 520" role="img" aria-labelledby="hero-visual-title hero-visual-desc">
        <title id="hero-visual-title">Surface observations to subsurface temperature</title>
        <desc id="hero-visual-desc">A conceptual ocean-data diagram showing surface observations flowing through an embedding into temperature layers at depth.</desc>
        <defs>
          <linearGradient id="surfacePlane" x1="0" x2="1"><stop offset="0" stopColor="#2a9db3" stopOpacity=".78" /><stop offset="1" stopColor="#0d527a" stopOpacity=".42" /></linearGradient>
          <linearGradient id="upperPlane" x1="0" x2="1"><stop offset="0" stopColor="#15799e" stopOpacity=".62" /><stop offset="1" stopColor="#093b60" stopOpacity=".42" /></linearGradient>
          <linearGradient id="midPlane" x1="0" x2="1"><stop offset="0" stopColor="#126789" stopOpacity=".56" /><stop offset="1" stopColor="#082f50" stopOpacity=".5" /></linearGradient>
          <linearGradient id="deepPlane" x1="0" x2="1"><stop offset="0" stopColor="#0c5474" stopOpacity=".48" /><stop offset="1" stopColor="#062642" stopOpacity=".58" /></linearGradient>
          <linearGradient id="lowerPlane" x1="0" x2="1"><stop offset="0" stopColor="#094460" stopOpacity=".42" /><stop offset="1" stopColor="#041c34" stopOpacity=".64" /></linearGradient>
          <linearGradient id="bottomPlane" x1="0" x2="1"><stop offset="0" stopColor="#073650" stopOpacity=".38" /><stop offset="1" stopColor="#021426" stopOpacity=".75" /></linearGradient>
          <filter id="softBlur"><feGaussianBlur stdDeviation="5" /></filter>
        </defs>

        <g className="hero-visual-labels">
          <text x="26" y="28">SURFACE OBSERVATIONS</text>
          <text x="26" y="47" className="visual-muted">DAILY INPUT STATE</text>
          <text x="421" y="28">NORTH INDIAN OCEAN</text>
        </g>

        <g className="observation-line">
          <path d="M48 76 H510" />
          <circle cx="92" cy="76" r="4" /><circle cx="170" cy="76" r="4" /><circle cx="251" cy="76" r="4" /><circle cx="337" cy="76" r="4" /><circle cx="431" cy="76" r="4" />
          <text x="76" y="101">SST</text><text x="157" y="101">SSS</text><text x="232" y="101">SSH</text><text x="309" y="101">CURRENTS</text><text x="420" y="101">WINDS</text>
        </g>

        <path className="data-flow" d="M280 108 V455" />
        <path className="flow-arrow" d="M274 444 L280 455 L286 444" />
        <text x="294" y="136" className="flow-label">OCEAN EMBEDDING</text>

        <g className="depth-planes">
          {planes.map((plane, index) => (
            <g key={plane.label} className="depth-plane" style={{ animationDelay: `${index * 90}ms` }}>
              <path d={`M78 ${plane.y} C155 ${plane.y - 18}, 221 ${plane.y + 17}, 296 ${plane.y} S433 ${plane.y - 16}, 488 ${plane.y + 2} L488 ${plane.y + 37} C404 ${plane.y + 52}, 361 ${plane.y + 23}, 284 ${plane.y + 40} S145 ${plane.y + 52}, 78 ${plane.y + 34} Z`} fill={plane.fill} />
              <path className="contour" d={`M92 ${plane.y + 12} C170 ${plane.y - 2}, 226 ${plane.y + 28}, 302 ${plane.y + 10} S414 ${plane.y + 1}, 476 ${plane.y + 18}`} />
              <path className="contour contour-soft" d={`M112 ${plane.y + 27} C191 ${plane.y + 13}, 237 ${plane.y + 40}, 319 ${plane.y + 25} S421 ${plane.y + 17}, 464 ${plane.y + 29}`} />
              <line className="depth-tick" x1="488" y1={plane.y + 18} x2="510" y2={plane.y + 18} />
              <text className="depth-label" x="518" y={plane.y + 22}>{plane.label}</text>
            </g>
          ))}
        </g>

        <g className="reconstruction-label">
          <line x1="78" y1="481" x2="488" y2="481" />
          <text x="78" y="505">RECONSTRUCTED TEMPERATURE</text>
          <text x="488" y="505" textAnchor="end" className="visual-muted">DEPTH-AWARE FIELD</text>
        </g>
      </svg>
    </div>
  );
}
