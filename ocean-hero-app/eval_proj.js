const d3 = require('d3-geo');
const proj = d3.geoEquirectangular().center([77.5, -2.5]).scale(600).translate([400, 250]);
console.log('25N:', proj([60, 25]));
console.log('20N:', proj([60, 20]));
console.log('30N:', proj([60, 30]));
