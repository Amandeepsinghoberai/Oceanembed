/**
 * lib/geodesicRoute.js
 * Scientifically defensible geodesic route geometry and vector projection utilities for OceanEmbed.
 */

const EARTH_RADIUS_KM = 6371.0088;

/**
 * Convert degrees to radians
 */
export function toRadians(degrees) {
  return (degrees * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 */
export function toDegrees(radians) {
  return (radians * 180) / Math.PI;
}

/**
 * Calculate Great-Circle / Geodesic distance between two points (in kilometers)
 */
export function calculateGeodesicDistance(lat1, lon1, lat2, lon2) {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

/**
 * Calculate initial bearing from point 1 to point 2 (in degrees 0..360)
 */
export function calculateBearing(lat1, lon1, lat2, lon2) {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const deltaLambda = toRadians(lon2 - lon1);

  const y = Math.sin(deltaLambda) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(deltaLambda);

  let bearingRad = Math.atan2(y, x);
  let bearingDeg = toDegrees(bearingRad);
  return (bearingDeg + 360) % 360;
}

/**
 * Sample N intermediate points along Great Circle arc between (lat1, lon1) and (lat2, lon2)
 */
export function sampleGreatCircleRoute(lat1, lon1, lat2, lon2, numSamples = 20) {
  if (numSamples < 2) return [];

  const phi1 = toRadians(lat1);
  const lambda1 = toRadians(lon1);
  const phi2 = toRadians(lat2);
  const lambda2 = toRadians(lon2);

  const dKm = calculateGeodesicDistance(lat1, lon1, lat2, lon2);
  if (dKm < 0.001) {
    return [{
      index: 0,
      lat: lat1,
      lon: lon1,
      distanceFromOriginKm: 0,
      bearingDeg: 0
    }];
  }

  const deltaPhi = toRadians(lat2 - lat1);
  const deltaLambda = toRadians(lon2 - lon1);

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);

  const dRad = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const samples = [];
  for (let i = 0; i < numSamples; i++) {
    const f = i / (numSamples - 1);
    
    let lat_f, lon_f;
    if (dRad < 1e-6) {
      lat_f = lat1;
      lon_f = lon1;
    } else {
      const A = Math.sin((1 - f) * dRad) / Math.sin(dRad);
      const B = Math.sin(f * dRad) / Math.sin(dRad);

      const x = A * Math.cos(phi1) * Math.cos(lambda1) + B * Math.cos(phi2) * Math.cos(lambda2);
      const y = A * Math.cos(phi1) * Math.sin(lambda1) + B * Math.cos(phi2) * Math.sin(lambda2);
      const z = A * Math.sin(phi1) + B * Math.sin(phi2);

      const phi_f = Math.atan2(z, Math.sqrt(x * x + y * y));
      const lambda_f = Math.atan2(y, x);

      lat_f = toDegrees(phi_f);
      lon_f = toDegrees(lambda_f);
    }

    const distanceFromOriginKm = f * dKm;

    samples.push({
      index: i,
      lat: parseFloat(lat_f.toFixed(4)),
      lon: parseFloat(lon_f.toFixed(4)),
      fraction: f,
      distanceFromOriginKm: parseFloat(distanceFromOriginKm.toFixed(1))
    });
  }

  // Calculate local heading bearings for each sample
  for (let i = 0; i < samples.length; i++) {
    let nextPoint = i < samples.length - 1 ? samples[i + 1] : samples[i];
    let prevPoint = i > 0 ? samples[i - 1] : samples[i];
    const headingDeg = calculateBearing(prevPoint.lat, prevPoint.lon, nextPoint.lat, nextPoint.lon);
    samples[i].bearingDeg = parseFloat(headingDeg.toFixed(1));
  }

  return samples;
}

/**
 * Sample a water-constrained route around Indian Ocean land masses (Sri Lanka, Horn of Africa, Sumatra).
 */
export function sampleWaterConstrainedRoute(lat1, lon1, lat2, lon2, totalSamples = 24) {
  const waypoints = [{ lat: lat1, lon: lon1 }];

  // Check if crossing India / Sri Lanka (West coast <-> East coast / SE Asia)
  const isWestOfIndia = lon1 < 77 && lat1 > 8;
  const isEastOfIndia = lon2 > 79 && lat2 > 8;
  const isReverseCross = lon2 < 77 && lat2 > 8 && lon1 > 79 && lat1 > 8;

  // South Sri Lanka chokepoint (Dondra Head offshore: 5.5°N, 80.5°E)
  if ((isWestOfIndia && isEastOfIndia) || isReverseCross) {
    waypoints.push({ lat: 5.5, lon: 80.5 });
  } else if ((lon1 < 77 && lon2 > 95 && lat2 > 0) || (lon2 < 77 && lon1 > 95 && lat1 > 0)) {
    // West India <-> Malacca Strait
    waypoints.push({ lat: 5.5, lon: 80.5 });
    waypoints.push({ lat: 5.5, lon: 95.5 });
  }

  waypoints.push({ lat: lat2, lon: lon2 });

  if (waypoints.length === 2) {
    return sampleGreatCircleRoute(lat1, lon1, lat2, lon2, totalSamples);
  }

  // Multi-segment sampling along waypoints
  const allSamples = [];
  const segments = waypoints.length - 1;
  const samplesPerSegment = Math.max(6, Math.floor(totalSamples / segments));
  let cumulativeDist = 0;

  for (let s = 0; s < segments; s++) {
    const pA = waypoints[s];
    const pB = waypoints[s + 1];
    const segSamples = sampleGreatCircleRoute(pA.lat, pA.lon, pB.lat, pB.lon, samplesPerSegment);

    segSamples.forEach((sample, i) => {
      if (s > 0 && i === 0) return; // avoid duplicate endpoints
      const dist = cumulativeDist + sample.distanceFromOriginKm;
      allSamples.push({
        ...sample,
        index: allSamples.length,
        distanceFromOriginKm: parseFloat(dist.toFixed(1))
      });
    });

    cumulativeDist += calculateGeodesicDistance(pA.lat, pA.lon, pB.lat, pB.lon);
  }

  return allSamples;
}

/**
 * Calculate component of ocean current vector along route heading.
 */
export function calculateAlongRouteCurrent(u, v, headingDeg) {
  if (u === null || v === null || isNaN(u) || isNaN(v)) return null;

  const headingRad = toRadians(headingDeg);
  const eastComponent = Math.sin(headingRad);
  const northComponent = Math.cos(headingRad);

  const alongRoute = u * eastComponent + v * northComponent;
  return parseFloat(alongRoute.toFixed(3));
}
