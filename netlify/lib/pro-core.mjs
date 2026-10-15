// 2Kreate Pro codes: everything behind /api/pro.
// Each code is one record in a Netlify Blobs store, saved under the code itself (like "2K-ABCD-2345").
// The app and the Discord bot both talk to this, so there's one list of codes for everything.
import crypto from "node:crypto";

// No 0/O or 1/I/L, so codes are easy to read off a phone and type in
export const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const DAY = 864e5;

export const PLANS = {
  week: { label: "7 days", days: 7 },
  month: { label: "30 days", days: 30 },
  season: { label: "Season pass" },
  life: { label: "Lifetime" },
};

export function makeCode() {
  let s = "";
  for (let i = 0; i < 8; i++) s += ALPHA[crypto.randomInt(ALPHA.length)];
  return `2K-${s.slice(0, 4)}-${s.slice(4)}`;
}

// Accepts "2k-abcd-2345", "ABCD2345", "2K ABCD 2345" and so on. Returns the tidy code or null.
export function cleanCode(raw) {
  let s = String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (s.length === 10 && s.startsWith("2K")) s = s.slice(2);
  if (s.length !== 8 || [...s].some((c) => !ALPHA.includes(c))) return null;
  return `2K-${s.slice(0, 4)}-${s.slice(4)}`;
}

function seasonEnd(env) {
  const d = String(env.PRO_SEASON_END || "2027-09-30").trim();
  const t = Date.parse(/^\d{4}-\d{2}-\d{2}$/.test(d) ? `${d}T23:59:59-07:00` : d);
  return Number.isFinite(t) ? t : Date.parse("2027-09-30T23:59:59-07:00");
}

// The clock starts the first time a code is used, not when it's made
function expFor(plan, now, env) {
  if (plan === "life") return null;
  if (plan === "season") return seasonEnd(env);
  return now + PLANS[plan].days * DAY;
}

export function statusOf(rec, now) {
  if (rec.revoked) return "off";
  if (!rec.first) return "new";
  if (rec.exp && now > rec.exp) return "expired";
  return "active";
}

const MSG = {
  format: "Codes look like 2K-ABCD-2345. Check it for typos.",
  missing: "That code doesn't exist. Check it for typos.",
  off: "That code has been turned off.",
  expired: "That code has expired.",
  full: (n) => `That code is already on ${n} device${n === 1 ? "" : "s"}. Remove it from one of them first, or ask for a reset.`,
  bad: "Something was missing from that request.",
};

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

function intIn(v, lo, hi, dflt) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : dflt;
}

function keyOk(given, env) {
  const real = String(env.PRO_ADMIN_KEY || "");
  if (real.length < 12 || !given) return false;
  const a = crypto.createHash("sha256").update(String(given)).digest();
  const b = crypto.createHash("sha256").update(real).digest();
  return crypto.timingSafeEqual(a, b);
}

async function load(store, code) {
  const r = await store.get(code, { type: "json" });
  return r && typeof r === "object" ? r : null;
}
const save = (store, rec) => store.setJSON(rec.code, rec);
async function loadAll(store) {
  const { blobs } = await store.list();
  return (await Promise.all(blobs.map((b) => load(store, b.key)))).filter(Boolean);
}

const pub = (rec) => ({ code: rec.code, plan: rec.plan, label: PLANS[rec.plan].label, exp: rec.exp });

function row(rec, now) {
  return {
    code: rec.code, plan: rec.plan, label: PLANS[rec.plan].label, note: rec.note || "",
    made: rec.made, first: rec.first, exp: rec.exp, status: statusOf(rec, now),
    devices: rec.devices.length, discord: rec.discord ? rec.discord.name || rec.discord.id : null,
  };
}

export async function handle(req, store, env = {}, now = Date.now()) {
  if (req.method === "GET") return json(200, { ok: true, service: "2Kreate Pro" });
  if (req.method !== "POST") return json(405, { ok: false, error: "Use POST." });

  let b;
  try { b = await req.json(); } catch { return json(400, { ok: false, error: MSG.bad }); }
  if (!b || typeof b !== "object") return json(400, { ok: false, error: MSG.bad });

  const act = String(b.action || "");
  const maxDev = intIn(env.PRO_MAX_DEVICES, 1, 10, 2);
  const dev = typeof b.device === "string" && /^[A-Za-z0-9_-]{8,64}$/.test(b.device) ? b.device : null;

  // ---- Anyone: the app uses these ----
  if (act === "redeem" || act === "check" || act === "release") {
    const code = cleanCode(b.code);
    if (!code) return json(400, { ok: false, gone: true, error: MSG.format });
    if (!dev) return json(400, { ok: false, error: MSG.bad });
    const rec = await load(store, code);

    if (act === "release") {
      if (rec && rec.devices.includes(dev)) {
        rec.devices = rec.devices.filter((d) => d !== dev);
        await save(store, rec);
      }
      return json(200, { ok: true });
    }

    if (!rec) return json(404, { ok: false, gone: true, error: MSG.missing });
    const st = statusOf(rec, now);
    if (st === "off" || st === "expired") return json(403, { ok: false, gone: true, error: MSG[st] });

    if (act === "check") {
      if (!rec.devices.includes(dev)) return json(403, { ok: false, gone: true, error: "This device was removed from that code." });
      return json(200, { ok: true, ...pub(rec) });
    }

    if (!rec.devices.includes(dev)) {
      if (rec.devices.length >= maxDev) return json(409, { ok: false, error: MSG.full(rec.devices.length) });
      rec.devices.push(dev);
    }
    if (!rec.first) { rec.first = now; rec.exp = expFor(rec.plan, now, env); }
    await save(store, rec);
    return json(200, { ok: true, ...pub(rec) });
  }

  // ---- Admin only: the Discord bot uses these ----
  if (String(env.PRO_ADMIN_KEY || "").length < 12) return json(503, { ok: false, error: "PRO_ADMIN_KEY isn't set on Netlify yet (it needs 12+ characters)." });
  if (!keyOk(req.headers.get("x-admin-key"), env)) return json(401, { ok: false, error: "Wrong admin key." });

  if (act === "make") {
    const plan = String(b.plan || "");
    if (!PLANS[plan]) return json(400, { ok: false, error: `Plan has to be one of: ${Object.keys(PLANS).join(", ")}.` });
    const count = intIn(b.count, 1, 20, 1);
    const note = String(b.note || "").slice(0, 60);
    const codes = [];
    while (codes.length < count) {
      const code = makeCode();
      if (codes.includes(code) || (await load(store, code))) continue;
      await save(store, { code, plan, note, made: now, first: null, exp: null, devices: [], discord: null, revoked: false });
      codes.push(code);
    }
    return json(200, { ok: true, plan, label: PLANS[plan].label, codes });
  }

  if (act === "list") {
    const recs = await loadAll(store);
    recs.sort((x, y) => y.made - x.made);
    const totals = { new: 0, active: 0, expired: 0, off: 0 };
    recs.forEach((r) => totals[statusOf(r, now)]++);
    return json(200, { ok: true, total: recs.length, totals, codes: recs.slice(0, intIn(b.limit, 1, 100, 15)).map((r) => row(r, now)) });
  }

  if (act === "discord-expired") {
    const recs = await loadAll(store);
    // Someone who renewed with a new code keeps the role, so their old code just gets marked done
    const stillPro = new Set(recs.filter((r) => r.discord && statusOf(r, now) === "active").map((r) => r.discord.id));
    const users = [];
    for (const r of recs) {
      if (!r.discord || r.discord.cleared || !["off", "expired"].includes(statusOf(r, now))) continue;
      if (stillPro.has(r.discord.id)) { r.discord.cleared = true; await save(store, r); }
      else users.push({ code: r.code, user: r.discord.id });
    }
    return json(200, { ok: true, users });
  }

  if (act === "discord-cleared") {
    const list = Array.isArray(b.codes) ? b.codes.slice(0, 200) : [];
    for (const c of list) {
      const rec = cleanCode(c) && (await load(store, cleanCode(c)));
      if (rec && rec.discord) { rec.discord.cleared = true; await save(store, rec); }
    }
    return json(200, { ok: true });
  }

  // Everything below works on one code
  const code = cleanCode(b.code);
  if (!code) return json(400, { ok: false, error: MSG.format });
  const rec = await load(store, code);
  if (!rec) return json(404, { ok: false, error: MSG.missing });

  if (act === "info") return json(200, { ok: true, ...row(rec, now) });

  if (act === "off" || act === "on") {
    rec.revoked = act === "off";
    await save(store, rec);
    return json(200, { ok: true, ...row(rec, now), user: rec.discord ? rec.discord.id : null });
  }

  if (act === "reset") {
    rec.devices = [];
    await save(store, rec);
    return json(200, { ok: true, ...row(rec, now) });
  }

  if (act === "discord") {
    const user = String(b.user || "");
    if (!/^\d{5,25}$/.test(user)) return json(400, { ok: false, error: MSG.bad });
    const st = statusOf(rec, now);
    if (st === "off" || st === "expired") return json(403, { ok: false, error: MSG[st] });
    if (rec.discord && rec.discord.id !== user) return json(409, { ok: false, error: "That code is already linked to a different Discord account." });
    if (!rec.first) { rec.first = now; rec.exp = expFor(rec.plan, now, env); }
    rec.discord = { id: user, name: String(b.name || "").slice(0, 40), at: now, cleared: false };
    await save(store, rec);
    return json(200, { ok: true, ...pub(rec) });
  }

  return json(400, { ok: false, error: "Unknown action." });
}
