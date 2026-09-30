// Archived Claude sensitivity calculation for NDL 962657 canvas 48 (plate 46).
// Output quantiles are conditional on the chosen parameter ranges and landmark identities;
// they are not an empirical confidence interval or an adopted 1912 tower dimension.
// Model: pinhole camera at eye height hc, pitched up by th, principal row y0 unknown (shift/crop allowed).
// Horizon row yh is observed from standing people's heads. y increases downward.
const rnd = (a, b) => a + Math.random() * (b - a);
const R = 15.15;                       // roof-garden floor, 50 shaku above ground (1912, 1913 texts)
const N = 200000, out = [];
for (let i = 0; i < N; i++) {
  const yh = rnd(1828, 1852), yFloor = rnd(1455, 1470), yNearCrown = rnd(1576, 1586);
  const yFarCrown = rnd(1661, 1692);   // far opening crown: 1665 seen; allow bright-vault bias downward
  const yTip = rnd(494, 506), yLantern = rnd(554, 566), yObsBottom = rnd(794, 806), yTurretTop = rnd(1266, 1278);
  const hc = rnd(1.3, 1.7), th = rnd(0, 3) * Math.PI / 180, f = rnd(900, 2000);
  const y0 = yh - f * Math.tan(th);    // horizon = y0 + f tan(th)
  const elev = (y) => th + Math.atan((y0 - y) / f);            // elevation angle of an image row
  const D = (R - hc) / Math.tan(elev(yFloor));                   // facade distance from roof-floor row
  const Hc = hc + D * Math.tan(elev(yNearCrown));                // arch crown height (near face)
  const L = (Hc - hc) / Math.tan(elev(yFarCrown)) - D;           // passage length (far face)
  if (!(L > 20 && L < 31 && D > 5 && D < 150)) continue;
  const dAxis = D + L / 2;
  const h = (y) => hc + dAxis * Math.tan(elev(y));
  const turret = hc + D * Math.tan(elev(yTurretTop));
  out.push({ D, L, f, Hc, turret, tip: h(yTip), lantern: h(yLantern), obs: h(yObsBottom) });
}
const q = (k, p) => { const s = out.map(o => o[k]).sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))].toFixed(1); };
console.log('samples', out.length);
for (const k of ['tip', 'lantern', 'obs', 'Hc', 'turret', 'L', 'D', 'f']) console.log(k.padEnd(8), 'p05', q(k, .05), ' p50', q(k, .5), ' p95', q(k, .95));
// what roof height would a 75.76 m tip require? (scale all heights-above-eye by the same factor)
const s = out.map(o => (75.76 - 1.5) / (o.tip - 1.5) * (R - 1.5) + 1.5).sort((a, b) => a - b);
console.log('roof needed for 75.76 m tip: p05', s[Math.floor(.05 * s.length)].toFixed(1), 'p50', s[Math.floor(.5 * s.length)].toFixed(1), 'p95', s[Math.floor(.95 * s.length)].toFixed(1));
