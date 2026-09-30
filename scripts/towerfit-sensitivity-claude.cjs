// Archived Claude sensitivity calculation for the 1921 plate-46 image.
// Chosen r/t rows are scenarios, not measured bounds or an adopted 1912 height.
// tip - hc = (yh - yTip)/k * (1 + t*(1/r - 1)),  k = (yh - yFloor)/(R - hc)
const yh = 1840, yFloor = 1462, yTip = 500, R = 15.15, hc = 1.5;
const k = (yh - yFloor) / (R - hc);
const rows = [];
for (const r of [0.648, 0.61, 0.566, 0.52]) for (const t of [0.5, 0.65, 0.8, 1.0]) rows.push({ r, t, tip: (hc + (yh - yTip) / k * (1 + t * (1 / r - 1))).toFixed(1) });
console.log('k=' + k.toFixed(2) + ' px/m');
console.log('r\t 0.5    0.65   0.8    1.0');
for (const r of [0.648, 0.61, 0.566, 0.52]) console.log(r + '  ' + rows.filter(x => x.r === r).map(x => x.tip.padStart(5)).join('  '));
