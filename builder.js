// /builder: make your own build with menus and buttons, like the app's sliders.
const E = require("./engine");
const { D } = E;
const { NAME, CODES, TIERS, PRESETS, BADGES, A } = D;

const RED = 0xe5202e;
const TIER_ICON = ["🔒", "🥉", "🥈", "🥇", "🏆"];
const STEPS = [-5, -1, 1, 5];
const sessions = new Map(); // message id -> build being made
const clip = (s, n = 1024) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

const DEFAULT_BODY = Object.keys(PRESETS).find((k) => k.startsWith("Blank PG 6'5")) || Object.keys(PRESETS)[0];

function start(userId, bodyKey) {
  const key = bodyKey || DEFAULT_BODY, p = PRESETS[key];
  return { user: userId, key, t: E.budgetOf(p), a: { ...p.a }, sel: "TP", note: "", seen: Date.now() };
}

// which badges use an attribute
const USES = {};
CODES.forEach((c) => {
  USES[c] = BADGES.filter((b) => b.t.some((tier) => tier.some((alt) => alt.some(([x]) => x === c)))).map((b) => b.n);
});

function view(s) {
  const p = PRESETS[s.key], raw = D.rawOf(s.a);
  const f = E.ovrOf(s.a, s.t), left = Math.max(0, Math.round(((s.t - raw) / s.t) * 100));
  const rows = E.badgeRows(s.a, p.h), on = rows.filter((r) => r.tier > 0);
  const bits = [`Height ${E.fmtH(p.h)}`];
  if (p.w) bits.push(`${p.w} lbs`);
  if (p.s) bits.push(`${E.fmtH(p.s)} wingspan`);

  const attrFields = A.map((g) => ({
    name: g[0], inline: true,
    value: g.slice(1).map(([c, n]) => `${c === s.sel ? "▶ " : ""}${n}: **${s.a[c]}**${p.c ? "/" + E.capOf(p, c) : ""}`).join("\n"),
  }));

  const uses = rows.filter((r) => USES[s.sel].includes(r.name))
    .sort((x, y) => y.tier - x.tier)
    .map((r) => `${TIER_ICON[r.tier]} ${r.name}: ${r.out ? "not at this height" : r.hint}`);

  const tiers = [];
  for (let t = 4; t >= 1; t--) {
    const n = on.filter((r) => r.tier === t).map((r) => r.name);
    if (n.length) tiers.push(`${TIER_ICON[t]} **${TIERS[t]} (${n.length})**: ${n.join(", ")}`);
  }

  const embed = {
    color: RED,
    title: clip(`Custom build on ${s.key}`, 256),
    description: `**OVR ${f >= 98.95 ? "99" : f.toFixed(1)}** · ${left}% of points left · ${on.length} of ${BADGES.length} badges\n${bits.join(" · ")}` +
      (s.note ? `\n\n⚠️ ${s.note}` : ""),
    fields: [
      ...attrFields,
      { name: `Badges that use ${NAME[s.sel]}`, value: clip(uses.join("\n") || "None") },
      { name: "Your badges", value: clip(tiers.join("\n") || "None yet. Raise some attributes.") },
    ],
    footer: { text: "Pick an attribute, then use the buttons. Only the person who started it can edit." },
  };

  const menu = {
    type: 1,
    components: [{
      type: 3, custom_id: "bl:sel", placeholder: "Pick an attribute",
      options: CODES.map((c) => ({
        label: `${NAME[c]}: ${s.a[c]}${p.c ? "/" + E.capOf(p, c) : ""}`, value: c, default: c === s.sel,
      })),
    }],
  };
  const btn = (label, id, style = 2) => ({ type: 2, style, label, custom_id: id });
  const row1 = { type: 1, components: [btn("Min", "bl:min"), ...STEPS.map((d) => btn(d > 0 ? `+${d}` : `${d}`, `bl:d:${d}`, d > 0 ? 1 : 2)), ] };
  const row2 = { type: 1, components: [btn("Max", "bl:max", 3), btn("Clear all to 25", "bl:clear", 4)] };
  return { embeds: [embed], components: [menu, row1, row2] };
}

function setTo(s, v) {
  const p = PRESETS[s.key], c = s.sel, cap = E.capOf(p, c);
  const want = Math.max(25, Math.min(cap, v));
  s.a = E.setAttr(s.a, s.t, c, want);
  s.note = want > s.a[s.sel] && v > s.a[s.sel]
    ? `${NAME[c]} stopped at ${s.a[c]}: you're out of points. Lower something else first.`
    : v > cap ? `${NAME[c]} maxes at ${cap} on this body.` : "";
}

function act(s, id, values) {
  s.seen = Date.now();
  if (id === "bl:sel") { s.sel = values[0]; s.note = ""; return; }
  if (id === "bl:min") return setTo(s, 25);
  if (id === "bl:max") return setTo(s, 99);
  if (id === "bl:clear") { CODES.forEach((c) => (s.a[c] = 25)); s.note = ""; return; }
  const m = /^bl:d:(-?\d+)$/.exec(id);
  if (m) setTo(s, s.a[s.sel] + +m[1]);
}

// forget builders nobody has touched in 3 hours
setInterval(() => {
  const old = Date.now() - 3 * 3600e3;
  for (const [k, s] of sessions) if (s.seen < old) sessions.delete(k);
}, 600e3).unref();

module.exports = { sessions, start, view, act };
