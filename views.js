// Turns builds, badges and events into Discord embeds (plain objects, so they're easy to test).
const fs = require("fs");
const path = require("path");
const E = require("./engine");
const { D } = E;
const { NAME, CODES, TIERS, PRESETS, BADGES, A } = D;

const RED = 0xe5202e;
const TIER_ICON = ["🔒", "🥉", "🥈", "🥇", "🏆"];
const clip = (s, n = 1024) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const ovrText = (f) => (f >= 98.95 ? "99" : f.toFixed(1));

function bodyLine(p) {
  const bits = [`Height ${E.fmtH(p.h)}`];
  if (p.w) bits.push(`${p.w} lbs`);
  if (p.s) bits.push(`${E.fmtH(p.s)} wingspan`);
  if (p.pos && p.pos !== "MINE") bits.push(p.pos);
  return bits.join(" · ");
}

function attrFields(p, attrs, changed = {}) {
  return A.map((g) => ({
    name: g[0],
    inline: true,
    value: g.slice(1).map(([c, n]) => {
      const cap = p.c ? `/${E.capOf(p, c)}` : "";
      const mark = changed[c] !== undefined ? ` (was ${changed[c]})` : "";
      return `${n}: **${attrs[c]}**${cap}${mark}`;
    }).join("\n"),
  }));
}

function badgeFields(rows) {
  const out = [];
  for (let t = 4; t >= 1; t--) {
    const names = rows.filter((r) => r.tier === t).map((r) => r.name);
    if (names.length) out.push({ name: `${TIER_ICON[t]} ${TIERS[t]} (${names.length})`, value: clip(names.join(", ")) });
  }
  return out;
}

function buildView(key) {
  const p = PRESETS[key];
  const t = E.budgetOf(p), f = E.ovrOf(p.a, t);
  const rows = E.badgeRows(p.a, p.h);
  const on = rows.filter((r) => r.tier > 0).length;
  return {
    color: RED,
    title: clip(key, 256),
    description: clip(`**OVR ${ovrText(f)}** · ${on} of ${BADGES.length} badges\n${bodyLine(p)}${p.n ? "\n\n" + p.n : ""}`, 4096),
    fields: [...attrFields(p, p.a), ...badgeFields(rows)],
    footer: { text: "GreenInputs · /tweak to change attributes, /badge for requirements" },
  };
}

function buildList(pos) {
  const keys = Object.keys(PRESETS).filter((k) => {
    const p = PRESETS[k];
    if (!pos) return true;
    if (pos === "MINE") return p.pos === "MINE";
    return p.pos === pos || k.includes(`(${pos} `) || k.includes(`/${pos} `) || k.includes(`(${pos}/`);
  });
  const lines = keys.map((k) => {
    const p = PRESETS[k];
    const n = E.badgeRows(p.a, p.h).filter((r) => r.tier > 0).length;
    return `• ${k} · ${n} badges`;
  });
  return {
    color: RED,
    title: pos ? `${pos === "MINE" ? "Your" : pos} builds (${keys.length})` : `All builds (${keys.length})`,
    description: clip(lines.join("\n") || "No builds found for that position.", 4096),
    footer: { text: "Open one with /build" },
  };
}

function badgeView(b, key) {
  const cat = D.CATS[D.BCAT[b.n]] || "";
  const reqs = b.t.map((tier, i) =>
    `${TIER_ICON[i + 1]} **${TIERS[i + 1]}**: ` +
    tier.map((alt) => alt.map(([c, v]) => `${v} ${NAME[c]}`).join(" + ")).join(" **or** ")
  ).join("\n");
  const heightLine = D.HC[b.n]
    ? "Height matters for this one: the best tier you can reach changes with height."
    : "";
  const range = b.min || b.max < 999 ? `Only from ${b.min ? E.fmtH(b.min) : "any height"} to ${b.max < 999 ? E.fmtH(b.max) : "any height"}.` : "";
  const fields = [];
  if (key) {
    const p = PRESETS[key];
    const r = E.badgeRows(p.a, p.h).find((x) => x.name === b.n);
    fields.push({
      name: `On ${clip(key, 200)}`,
      value: `${TIER_ICON[r.tier]} ${r.out ? "Not available at this height" : TIERS[r.tier]}\n${r.out ? "" : r.hint}`,
    });
  }
  return {
    color: RED,
    title: b.n,
    description: clip([cat && `${cat} · ${D.BCOST[b.n] || "?"} token cost`, reqs, heightLine, range].filter(Boolean).join("\n\n"), 4096),
    fields,
  };
}

// changes like "DD 80, three point 75"
function parseChanges(text) {
  const out = [], bad = [];
  text.split(/[,;]+/).map((s) => s.trim()).filter(Boolean).forEach((part) => {
    const m = /^(.*?)[\s:=]+(\d{2})$/.exec(part);
    const c = m && E.findAttr(m[1].trim());
    if (c) out.push([c, +m[2]]); else bad.push(part);
  });
  return { out, bad };
}

function tweakView(key, text) {
  const p = PRESETS[key], t = E.budgetOf(p);
  const { out, bad } = parseChanges(text);
  if (!out.length) return { error: 'Try something like `DD 80, TP 70` or `Driving Dunk 80, Three-Point 70`.' };
  let a = { ...p.a };
  const notes = [], changed = {};
  // lower first so the freed budget can be spent on the raises
  out.sort((x, y) => (x[1] - p.a[x[0]]) - (y[1] - p.a[y[0]])).forEach(([c, v]) => {
    const cap = E.capOf(p, c), want = Math.max(25, Math.min(cap, v));
    if (want !== v) notes.push(`${NAME[c]} capped at ${want} on this body.`);
    const prev = a[c];
    a = E.setAttr(a, t, c, want);
    if (a[c] < want) notes.push(`${NAME[c]} stopped at ${a[c]}: out of budget. Lower something else in the same command to free it up.`);
    if (a[c] !== prev) changed[c] = p.a[c];
  });
  if (bad.length) notes.push(`Didn't recognize: ${bad.join(", ")}`);

  const before = E.badgeRows(p.a, p.h), after = E.badgeRows(a, p.h);
  const diff = [];
  after.forEach((r, i) => {
    const o = before[i].tier;
    if (r.tier !== o) diff.push(`${r.tier > o ? "⬆️" : "⬇️"} ${r.name}: ${TIERS[o]} → ${TIERS[r.tier]}`);
  });
  const f0 = E.ovrOf(p.a, t), f1 = E.ovrOf(a, t);
  const fields = [{ name: "Badge changes", value: clip(diff.join("\n") || "No badge changes.") }];
  if (notes.length) fields.push({ name: "Heads up", value: clip(notes.join("\n")) });
  fields.push(...attrFields(p, a, changed).filter((f) => Object.keys(changed).some((c) => f.value.includes(NAME[c] + ":"))));
  return {
    color: RED,
    title: clip(`${key}, tweaked`, 256),
    description: `**OVR ${ovrText(f0)} → ${ovrText(f1)}** · ${after.filter((r) => r.tier).length} badges (was ${before.filter((r) => r.tier).length})`,
    fields,
  };
}

function compareView(k1, k2) {
  const p1 = PRESETS[k1], p2 = PRESETS[k2];
  const lines = CODES.map((c) => {
    const d = p1.a[c] - p2.a[c];
    return `${NAME[c]}: ${p1.a[c]} vs ${p2.a[c]}${d ? ` (${d > 0 ? "+" : ""}${d})` : ""}`;
  });
  const r1 = E.badgeRows(p1.a, p1.h), r2 = E.badgeRows(p2.a, p2.h);
  const better = (x, y) => x.filter((r, i) => r.tier > y[i].tier).map((r, i) => `${r.name} (${TIERS[r.tier]})`);
  const b1 = better(r1, r2), b2 = better(r2, r1);
  return {
    color: RED,
    title: "Build compare",
    description: `**A:** ${k1}\n${bodyLine(p1)}\n**B:** ${k2}\n${bodyLine(p2)}`,
    fields: [
      { name: "Attributes (A vs B)", value: clip(lines.slice(0, 11).join("\n")), inline: true },
      { name: "\u200b", value: clip(lines.slice(11).join("\n")), inline: true },
      { name: `Better on A (${b1.length})`, value: clip(b1.join(", ") || "None") },
      { name: `Better on B (${b2.length})`, value: clip(b2.join(", ") || "None") },
    ],
  };
}

// Events: same rules as the app (start at local midnight, last through the end day)
function tm(s, end) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return Date.parse(s);
  return new Date(+m[1], +m[2] - 1, +m[3] + (end ? 1 : 0)).getTime();
}
async function getEvents() {
  const url = process.env.EVENTS_URL;
  if (url) {
    try {
      const r = await fetch(url + (url.includes("?") ? "&" : "?") + "t=" + Date.now());
      if (r.ok) return await r.json();
    } catch (e) { /* fall back to the local file */ }
  }
  return JSON.parse(fs.readFileSync(path.join(__dirname, "events.json"), "utf8"));
}
async function eventsView() {
  const j = await getEvents(), now = Date.now();
  const list = (j.events || []).filter((e) => now < tm(e.end, 1)).slice(0, 10);
  const fields = list.map((e) => {
    const a = tm(e.start), b = tm(e.end, 1);
    const when = now >= a ? `🟢 Live now, ends <t:${Math.floor(b / 1000)}:R>` : `Starts <t:${Math.floor(a / 1000)}:R>`;
    return { name: clip(`${e.n} · ${e.when}`, 256), value: clip(`${when}\n${e.note || ""}`) };
  });
  return {
    color: RED,
    title: "Upcoming events",
    description: fields.length ? undefined : "Nothing on the calendar right now. Check back soon.",
    fields,
    footer: { text: j.updated ? `Updated ${j.updated}` : "GreenInputs" },
  };
}

module.exports = { buildView, buildList, badgeView, tweakView, compareView, eventsView, parseChanges };
