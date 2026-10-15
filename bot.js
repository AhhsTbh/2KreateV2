require("dotenv").config();
const { Client, GatewayIntentBits, Events, MessageFlags } = require("discord.js");
const E = require("./engine");
const V = require("./views");
const commands = require("./commands");
const B = require("./builder");
const P = require("./pro");

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const buildNames = Object.keys(E.D.PRESETS);
const badgeNames = E.D.BADGES.map((b) => b.n);

function suggest(list, typed) {
  const q = (typed || "").toLowerCase();
  return list.filter((n) => n.toLowerCase().includes(q)).slice(0, 25)
    .map((n) => ({ name: n.slice(0, 100), value: n.slice(0, 100) }));
}

const notFound = (what, q) => ({ content: `Couldn't find a ${what} called "${q}". Pick one from the list as you type.`, flags: MessageFlags.Ephemeral });

client.on(Events.InteractionCreate, async (i) => {
  try {
    if (i.isAutocomplete()) {
      const f = i.options.getFocused(true);
      return i.respond(suggest(f.name === "name" ? badgeNames : buildNames, f.value));
    }
    if ((i.isButton() || i.isStringSelectMenu()) && i.customId.startsWith("bl:")) {
      const s = B.sessions.get(i.message.id);
      if (!s) return i.reply({ content: "This builder timed out. Start a new one with /builder.", flags: MessageFlags.Ephemeral });
      if (s.user !== i.user.id) return i.reply({ content: "That's someone else's build. Start your own with /builder.", flags: MessageFlags.Ephemeral });
      B.act(s, i.customId, i.values);
      return i.update(B.view(s));
    }
    if (!i.isChatInputCommand()) return;
    if (P.handles(i.commandName)) return await P.handle(i);
    if (P.needsPro(i)) return i.reply(P.lockedReply(i.commandName));
    const s = (n) => i.options.getString(n);

    switch (i.commandName) {
      case "build": {
        const k = E.findBuild(s("build"));
        return i.reply(k ? { embeds: [V.buildView(k)] } : notFound("build", s("build")));
      }
      case "builds":
        return i.reply({ embeds: [V.buildList(s("position"))] });
      case "badge": {
        const b = E.findBadge(s("name"));
        if (!b) return i.reply(notFound("badge", s("name")));
        const k = s("build") ? E.findBuild(s("build")) : null;
        if (s("build") && !k) return i.reply(notFound("build", s("build")));
        return i.reply({ embeds: [V.badgeView(b, k)] });
      }
      case "tweak": {
        const k = E.findBuild(s("build"));
        if (!k) return i.reply(notFound("build", s("build")));
        const v = V.tweakView(k, s("changes"));
        return i.reply(v.error ? { content: v.error, flags: MessageFlags.Ephemeral } : { embeds: [v] });
      }
      case "compare": {
        const a = E.findBuild(s("a")), b = E.findBuild(s("b"));
        if (!a) return i.reply(notFound("build", s("a")));
        if (!b) return i.reply(notFound("build", s("b")));
        return i.reply({ embeds: [V.compareView(a, b)] });
      }
      case "builder": {
        const k = s("body") ? E.findBuild(s("body")) : null;
        if (s("body") && !k) return i.reply(notFound("build", s("body")));
        const st = B.start(i.user.id, k);
        await i.reply(B.view(st));
        const msg = await i.fetchReply();
        B.sessions.set(msg.id, st);
        return;
      }
      case "events":
        await i.deferReply();
        return i.editReply({ embeds: [await V.eventsView()] });
    }
  } catch (e) {
    console.error(e);
    const msg = { content: "Something went wrong with that one. Try again.", flags: MessageFlags.Ephemeral };
    if (i.isRepliable()) (i.deferred || i.replied ? i.followUp(msg) : i.reply(msg)).catch(() => {});
  }
});

// Puts the slash commands straight into every server the bot is in, so they show up right away
async function register(guild) {
  try {
    await guild.commands.set(commands);
    console.log(`Commands added to ${guild.name}`);
  } catch (e) {
    console.error(`Couldn't add commands to ${guild.name}. Re-invite the bot with "applications.commands" ticked.`, e.message);
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`2Kreate bot is online as ${c.user.tag}, in ${c.guilds.cache.size} server(s)`);
  if (!c.guilds.cache.size) console.log("The bot isn't in any server yet. Open the invite link from OAuth2 > URL Generator.");
  for (const g of c.guilds.cache.values()) await register(g);
  P.start(c);
});
client.on(Events.GuildCreate, register);
if (!process.env.DISCORD_TOKEN) {
  console.error("DISCORD_TOKEN is missing. Add it in Railway > Variables.");
  process.exit(1);
}
client.login(process.env.DISCORD_TOKEN).catch((e) => {
  console.error("Discord rejected the token. Reset it in the developer portal (Bot tab) and paste the new one into Railway.", e.message);
  process.exit(1);
});
