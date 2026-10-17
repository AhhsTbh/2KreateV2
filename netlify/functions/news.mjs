// GreenInputs live news. Serves NBA 2K27 headlines from Google News at /api/news.
// Headlines refresh four times a day: 8 AM, 12 PM, 4 PM and 9 PM Eastern (it follows daylight saving).
// Netlify's CDN keeps each refresh until the next one, so this only runs a few times a day.

const SLOTS = [8, 12, 16, 21]; // hours, America/New_York
const TZ = "America/New_York";
const QUERIES = ['"NBA 2K27"', '"NBA 2K" Season 2 OR patch OR update'];

function nyParts(d) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const p = Object.fromEntries(f.formatToParts(d).filter((x) => x.type !== "literal").map((x) => [x.type, +x.value]));
  return p;
}
// Real time of a New York wall-clock moment
function nyTime(y, m, d, h) {
  const guess = Date.UTC(y, m - 1, d, h);
  const p = nyParts(new Date(guess));
  const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return new Date(guess - (asUTC - guess));
}
function slotWindow(now) {
  const c = [];
  for (let back = -1; back <= 1; back++) {
    const p = nyParts(new Date(now.getTime() + back * 86400000));
    for (const h of SLOTS) c.push(nyTime(p.year, p.month, p.day, h));
  }
  c.sort((a, b) => a - b);
  let last = c[0], next = c[c.length - 1];
  for (const t of c) { if (t <= now) last = t; else { next = t; break; } }
  return { last, next };
}
const ENT = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };
function decode(s) {
  return String(s || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m)
    .trim();
}
function tag(block, name) {
  const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"));
  return m ? decode(m[1]) : "";
}
async function fetchQuery(q) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q + " when:7d")}&hl=en-US&gl=US&ceid=US:en`;
  const r = await fetch(url, { headers: { "User-Agent": "GreenInputs/1.0 (+news headlines)" } });
  if (!r.ok) throw new Error(`feed ${r.status}`);
  const xml = await r.text();
  const items = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1];
    const s = tag(b, "source");
    let t = tag(b, "title");
    if (s && t.endsWith(" - " + s)) t = t.slice(0, -(s.length + 3));
    const u = tag(b, "link");
    const d = new Date(tag(b, "pubDate"));
    if (!t || !/^https?:\/\//.test(u) || isNaN(d)) continue;
    items.push({ t, u, s: s || "News", d: d.toISOString() });
  }
  return items;
}

export default async () => {
  const now = new Date();
  const { last, next } = slotWindow(now);
  const ttl = Math.max(60, Math.round((next - now) / 1000));
  try {
    const lists = await Promise.allSettled(QUERIES.map(fetchQuery));
    const seen = new Set();
    const items = lists
      .flatMap((x) => (x.status === "fulfilled" ? x.value : []))
      .filter((i) => new Date(i.d) <= last) // same headlines for everyone until the next refresh
      .filter((i) => { const k = i.t.toLowerCase().replace(/\W+/g, " ").trim(); if (seen.has(k)) return false; seen.add(k); return true; })
      .sort((a, b) => new Date(b.d) - new Date(a.d))
      .slice(0, 20);
    if (!items.length && lists.every((x) => x.status === "rejected")) throw new Error("all feeds failed");
    return new Response(JSON.stringify({ updated: last.toISOString(), next: next.toISOString(), items }), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "public, max-age=300",
        "Netlify-CDN-Cache-Control": `public, s-maxage=${ttl}, durable`,
      },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "News is unavailable right now.", items: [] }), {
      status: 502,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "Netlify-CDN-Cache-Control": "public, s-maxage=120" },
    });
  }
};

export const config = { path: "/api/news" };
