// 2Kreate Pro in Discord: admins make and manage codes, members redeem them for the Pro role.
// The codes live on the site at /api/pro, so one code works in the app and here.
// Railway variables: SITE_URL, PRO_ADMIN_KEY (same as on Netlify), PRO_ROLE_ID.
// Optional: PRO_COMMANDS (which commands need Pro, default "builder,tweak"), PRO_BUY_URL (where to get a code).
const { PermissionFlagsBits, MessageFlags } = require("discord.js");

let SITE = (process.env.SITE_URL || "").trim().replace(/\/+$/, "");
if (SITE && !/^https?:\/\//i.test(SITE)) SITE = "https://" + SITE;
const KEY = (process.env.PRO_ADMIN_KEY || "").trim();
const ROLE = (process.env.PRO_ROLE_ID || "").trim();
const BUY = (process.env.PRO_BUY_URL || "").trim();
const GATED = (process.env.PRO_COMMANDS ?? "builder,tweak")
  .split(",").map((s) => s.trim().toLowerCase().replace(/^\//, "")).filter((c) => c && c !== "none");

const GOLD = 0xe8bd2f;
const EPH = MessageFlags.Ephemeral;
const ready = () => Boolean(SITE && KEY);
const when = (t, style = "D") => `<t:${Math.floor(t / 1000)}:${style}>`;
const isAdmin = (i) => Boolean(i.memberPermissions && i.memberPermissions.has(PermissionFlagsBits.Administrator));

async function api(action, body = {}) {
  const r = await fetch(`${SITE}/api/pro`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-admin-key": KEY },
    body: JSON.stringify({ action, ...body }),
  });
  try {
    return await r.json();
  } catch {
    throw new Error(`The site answered ${r.status}. Check SITE_URL in Railway and that the latest app is deployed on Netlify.`);
  }
}

// ---- Locking commands behind the Pro role ----
function hasRole(i) {
  const roles = i.member && i.member.roles;
  if (!roles) return false;
  return Array.isArray(roles) ? roles.includes(ROLE) : Boolean(roles.cache && roles.cache.has(ROLE));
}
function needsPro(i) {
  if (!ROLE || !GATED.includes(i.commandName)) return false;
  return !(isAdmin(i) || hasRole(i));
}
function lockedReply(name) {
  const get = BUY ? `Get a code at ${BUY}` : "Get a code from the server admins";
  return { content: `**/${name}** is a 2Kreate Pro command. ${get}, then use **/redeem**.`, flags: EPH };
}

// ---- /redeem ----
async function redeem(i) {
  if (!ready() || !ROLE || !i.inGuild()) {
    return i.reply({ content: "Pro isn't set up in this server yet. Ask an admin.", flags: EPH });
  }
  await i.deferReply({ flags: EPH });
  const j = await api("discord", { code: i.options.getString("code"), user: i.user.id, name: i.user.username });
  if (!j.ok) return i.editReply(j.error || "That code didn't work.");
  let roleNote = "";
  try {
    const m = i.member && i.member.roles && i.member.roles.add ? i.member : await i.guild.members.fetch(i.user.id);
    await m.roles.add(ROLE, `Redeemed Pro code ${j.code}`);
  } catch (e) {
    console.error("Couldn't give the Pro role:", e.message);
    roleNote = "\n\nYour code is linked, but I couldn't give you the Pro role. An admin needs to give me Manage Roles and drag my role above Pro in Server Settings > Roles.";
  }
  const until = j.exp ? `good until ${when(j.exp)}` : "never expires";
  return i.editReply(`You're Pro! ${j.label}, ${until}. The same code also unlocks Pro in the 2Kreate app.${roleNote}`);
}

// ---- /pro (admins) ----
const STATUS = { new: "unused", active: "active", expired: "expired", off: "turned off" };
function line(c) {
  const bits = [`\`${c.code}\``, c.label, STATUS[c.status]];
  if (c.status === "active" && c.exp) bits.push(`until ${when(c.exp, "d")}`);
  if (c.devices) bits.push(`${c.devices} device${c.devices === 1 ? "" : "s"}`);
  if (c.discord) bits.push(`Discord: ${c.discord}`);
  if (c.note) bits.push(c.note);
  return bits.join(" · ");
}

// true when they don't have the role anymore (or aren't in the server)
async function dropRole(guild, user, why) {
  try {
    const m = await guild.members.fetch(user);
    if (m.roles.cache.has(ROLE)) await m.roles.remove(ROLE, why);
    return true;
  } catch (e) {
    if ([10007, 10013].includes(e.code)) return true;
    console.error("Couldn't remove the Pro role:", e.message);
    return false;
  }
}

async function admin(i) {
  if (!isAdmin(i)) return i.reply({ content: "Only admins can manage Pro codes.", flags: EPH });
  if (!ready()) return i.reply({ content: "Add SITE_URL and PRO_ADMIN_KEY in Railway > Variables first, then redeploy.", flags: EPH });
  await i.deferReply({ flags: EPH });
  const sub = i.options.getSubcommand();

  if (sub === "make") {
    const note = i.options.getString("note") || "";
    const j = await api("make", { plan: i.options.getString("plan"), note, count: i.options.getInteger("count") || 1 });
    if (!j.ok) return i.editReply(j.error);
    const n = j.codes.length;
    const what = n === 1 ? "It's in the next message by itself, so it's easy to copy." : "They're in the next message by themselves, so they're easy to copy.";
    await i.editReply(`**${n} code${n === 1 ? "" : "s"}, ${j.label}**${note ? ` for ${note}` : ""}. Each one works on 2 devices in the app plus one Discord account, and the clock starts the first time it's used. ${what}`);
    return i.followUp({ content: j.codes.join("\n"), flags: EPH });
  }

  if (sub === "list") {
    const j = await api("list", { limit: 15 });
    if (!j.ok) return i.editReply(j.error);
    const t = j.totals;
    const head = `${t.active} active · ${t.new} unused · ${t.expired} expired · ${t.off} off`;
    const body = j.codes.length ? j.codes.map(line).join("\n") : "No codes yet. Make one with /pro make.";
    return i.editReply({ embeds: [{ color: GOLD, title: `Pro codes (${j.total})`, description: `${head}\n\n${body}`.slice(0, 4096), footer: { text: j.total > 15 ? "Newest 15 shown" : "2Kreate Pro" } }] });
  }

  const j = await api(sub, { code: i.options.getString("code") });
  if (!j.ok) return i.editReply(j.error);
  if (sub === "info") return i.editReply(line(j));
  if (sub === "off") {
    if (j.user && ROLE) await dropRole(i.guild, j.user, `Pro code ${j.code} turned off`);
    return i.editReply(`Turned off \`${j.code}\`. It stops working in the app the next time it checks in, and the Pro role is gone if it was used here.`);
  }
  if (sub === "on") return i.editReply(`\`${j.code}\` works again. If it was used in Discord, they'll need to /redeem it again to get the role back.`);
  if (sub === "reset") return i.editReply(`Cleared the devices on \`${j.code}\`. It can be typed into 2 new devices now.`);
  return i.editReply("Unknown option.");
}

// ---- Take the Pro role back when a code expires or gets turned off (runs every hour) ----
async function sweep(client) {
  if (!ready() || !ROLE) return;
  try {
    const j = await api("discord-expired");
    if (!j.ok || !j.users || !j.users.length) return;
    const guilds = [...client.guilds.cache.values()].filter((g) => g.roles.cache.has(ROLE));
    const done = [];
    for (const { code, user } of j.users) {
      let ok = true;
      for (const g of guilds) if (!(await dropRole(g, user, `Pro code ${code} ended`))) ok = false;
      if (ok) done.push(code);
    }
    if (done.length) await api("discord-cleared", { codes: done });
  } catch (e) {
    console.error("Pro role cleanup failed:", e.message);
  }
}

function start(client) {
  if (!ROLE) console.log("Pro: PRO_ROLE_ID isn't set, so every command is free and /redeem is off.");
  else if (!ready()) console.log("Pro: set SITE_URL and PRO_ADMIN_KEY to turn on codes.");
  else console.log(`Pro is on. Pro-only commands: ${GATED.map((c) => "/" + c).join(", ") || "none"}`);
  sweep(client);
  setInterval(() => sweep(client), 60 * 60 * 1000);
}

const handles = (name) => name === "redeem" || name === "pro";
const handle = (i) => (i.commandName === "redeem" ? redeem(i) : admin(i));

module.exports = { handles, handle, needsPro, lockedReply, start, sweep };
