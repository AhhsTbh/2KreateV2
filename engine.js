// Loads builds, badges and caps straight out of the GreenInputs app (index.html),
// so when you edit the app and copy index.html into this folder, the bot picks up the changes on restart.
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const APP = path.join(__dirname, "index.html");

function slice(src, from, to) {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  if (a < 0 || b < 0) throw new Error(`Couldn't find "${from}" in index.html`);
  return src.slice(a, b);
}

function load() {
  const html = fs.readFileSync(APP, "utf8");
  const code = [
    slice(html, "var A=", "var PASS="),                 // attributes, badges, builds, OVR math, height caps
    slice(html, "var MEANT=", "\n") + "\n",             // average build budget
    slice(html, "var TOKC=", "var POOL="),              // badge categories + token costs
    "this.out={A,NAME,CODES,BADGES,TIERS,PRESETS,W,HC,MEANT,CATS:typeof CATS!=='undefined'?CATS:null,BCAT,BCOST,rawOf,capT};",
  ].join("\n");
  const ctx = { S: { h: 78, a: {} } };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  const cats = slice(html, "var CATS=", ";");
  ctx.out.CATS = vm.runInNewContext(cats.replace("var CATS=", ""));
  return { ...ctx.out, S: ctx.S };
}

const D = load();
const { NAME, CODES, BADGES, TIERS, PRESETS, W, S } = D;

// Same budget rule the app uses when you load a build
function budgetOf(p) {
  let t = p.t || D.rawOf(p.a);
  if (t < 100) t = D.MEANT;
  return t;
}
function ovrOf(a, t) {
  return Math.min(99, Math.max(25, 25 + (74 * D.rawOf(a)) / t));
}
function withS(a, h, fn) {
  const oa = S.a, oh = S.h;
  S.a = a; S.h = h;
  try { return fn(); } finally { S.a = oa; S.h = oh; }
}
function alt(a, attrs) {
  const d = [];
  a.forEach(([c, v]) => { const g = v - attrs[c]; if (g > 0) d.push([c, g]); });
  return d;
}
function tierOf(b, attrs) {
  let t = 0;
  b.t.forEach((tier, i) => { if (tier.some((a) => alt(a, attrs).length === 0)) t = i + 1; });
  return t;
}
function gapText(b, t, attrs) {
  let best = null;
  b.t[t].forEach((a) => {
    const d = alt(a, attrs), s = d.reduce((m, x) => m + x[1], 0);
    if (!best || s < best.s) best = { s, d };
  });
  return best.d.map(([c, g]) => `+${g} ${NAME[c]}`).join(", ");
}

// Badge results for a set of attributes at a height, same as the app's badge list
function badgeRows(attrs, h) {
  return withS(attrs, h, () =>
    BADGES.map((b) => {
      const cap = D.capT(b), raw = tierOf(b, attrs), t = Math.min(raw, cap);
      const hint = cap === 0 ? "Not available at this height"
        : t === 4 ? "Maxed out"
        : t >= cap ? `Height cap: ${TIERS[cap]} is the max here`
        : `Next: ${gapText(b, t, attrs)} for ${TIERS[t + 1]}`;
      return { name: b.n, tier: cap === 0 ? 0 : t, out: cap === 0, cap, hint };
    })
  );
}

// Mirrors the app's slider: raising one attribute stops when the build's budget is spent
function setAttr(attrs, t, code, v) {
  const a = { ...attrs }, prev = a[code];
  a[code] = v;
  const ex = D.rawOf(a) - t;
  if (ex > 0) a[code] = Math.max(prev, Math.min(v, Math.floor(v - ex / W[code])));
  return a;
}

function findBuild(q) {
  if (!q) return null;
  if (PRESETS[q]) return q;
  const l = q.toLowerCase();
  return Object.keys(PRESETS).find((k) => k.toLowerCase() === l)
    || Object.keys(PRESETS).find((k) => k.toLowerCase().includes(l)) || null;
}
function findBadge(q) {
  if (!q) return null;
  const l = q.toLowerCase();
  return BADGES.find((b) => b.n.toLowerCase() === l)
    || BADGES.find((b) => b.n.toLowerCase().includes(l)) || null;
}
function findAttr(q) {
  if (!q) return null;
  const l = q.toLowerCase();
  return CODES.find((c) => c.toLowerCase() === l || NAME[c].toLowerCase() === l)
    || CODES.find((c) => NAME[c].toLowerCase().includes(l)) || null;
}
function capOf(p, code) { return p.c ? p.c[CODES.indexOf(code)] : 99; }
function fmtH(h) { return `${Math.floor(h / 12)}'${h % 12}"`; }

module.exports = {
  D, budgetOf, ovrOf, badgeRows, setAttr, findBuild, findBadge, findAttr, capOf, fmtH,
};
