const fs = require('fs');

try {
  let fileData = fs.readFileSync('public/data/world.geojson', 'utf8');
  let data = JSON.parse(fileData);
  
  // Rough bounding box for Indian Ocean + Subcontinent + Africa + SE Asia + Arabian Peninsula
  const minLon = 25;
  const maxLon = 130;
  const minLat = -35;
  const maxLat = 40;

  data.features = data.features.filter(f => {
    if (!f.geometry || !f.geometry.coordinates) return false;
    
    let coords = f.geometry.coordinates;
    const checkPt = (pt) => pt[0] >= minLon && pt[0] <= maxLon && pt[1] >= minLat && pt[1] <= maxLat;
    
    if (f.geometry.type === 'Polygon') {
      return coords[0].some(checkPt);
    } else if (f.geometry.type === 'MultiPolygon') {
      return coords.some(poly => poly[0].some(checkPt));
    }
    return false;
  });

  fs.writeFileSync('public/data/indianOcean.geojson', JSON.stringify(data));
  console.log("Successfully extracted regional GeoJSON. Features remaining: " + data.features.length);
} catch (e) {
  console.error("Error formatting geographic data:", e);
}
