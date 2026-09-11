export default function NorthIndianOceanMap() {
  return (
    <div className="data-svg region-map-svg">
      <svg viewBox="0 0 900 470" role="img" aria-label="North Indian Ocean target region map">
        <defs><clipPath id="regionClip"><rect x="30" y="30" width="840" height="360" /></clipPath></defs>
        <g className="map-grid">{[0, 1, 2, 3, 4, 5, 6].map(i => <line key={`v-${i}`} x1={30 + i * 140} y1="30" x2={30 + i * 140} y2="390" />)}{[0, 1, 2, 3, 4].map(i => <line key={`h-${i}`} x1="30" y1={30 + i * 90} x2="870" y2={30 + i * 90} />)}</g>
        <g clipPath="url(#regionClip)" className="map-land"><path d="M30 30 H520 L560 74 L614 85 L650 125 L720 153 L760 208 L870 232 V30 Z" /><path d="M30 390 H870 V330 L810 318 L760 330 L700 315 L650 337 L580 324 L510 350 L430 328 L350 345 L260 320 L170 340 L100 318 L30 330 Z" /><path d="M670 390 C632 350 638 312 678 288 C714 270 760 282 784 318 C797 345 784 376 756 390 Z" /></g>
        <rect className="region-highlight" x="310" y="120" width="390" height="180" />
        <text className="map-title" x="54" y="62">NORTH INDIAN OCEAN</text><text className="map-label" x="82" y="117">30°N</text><text className="map-label" x="82" y="385">5°N</text><text className="map-label" x="52" y="414">45°E</text><text className="map-label" x="810" y="414">105°E</text>
        <text className="region-name" x="392" y="176">ARABIAN SEA</text><text className="region-name" x="630" y="270">BAY OF BENGAL</text>
        <circle className="map-point" cx="500" cy="205" r="4" /><circle className="map-point" cx="690" cy="245" r="4" />
        <text className="svg-muted" x="30" y="455">TARGET REGION · 5°N–30°N · 45°E–105°E</text>
      </svg>
    </div>
  );
}
