// Single real source for the model accuracy numbers shown on both the
// /technology page and the homepage stat bar. Keep this the only place
// these literals are defined — everything else should import from here.

export type RegionStats = {
  rmse: number;
  correlation: number;
  n: number;
  inputs: string[];
  clusters: number;
  bias: number;
};

export const REGION_SUMMARY: Record<string, RegionStats> = {
  "BAY OF BENGAL": { rmse: 0.637, correlation: 0.997, n: 30019, inputs: ["SST", "SSH"], clusters: 5, bias: -0.385 },
  "ARABIAN SEA": { rmse: 0.834, correlation: 0.988, n: 2129593, inputs: ["SST", "SSH", "Wind Stress Curl", "MLD", "SSS", "Eddy Vorticity"], clusters: 10, bias: 0.066 },
};

// Fixed en-US thousands grouping — Number.toLocaleString() depends on the
// runtime's locale, which differs between server (SSR) and browser and
// causes a hydration mismatch. This is deterministic on both sides.
export function formatCount(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export const TOTAL_ARGO_VALIDATED = REGION_SUMMARY["BAY OF BENGAL"].n + REGION_SUMMARY["ARABIAN SEA"].n;
