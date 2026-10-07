// Run once (and again whenever you change commands): npm run deploy
require("dotenv").config();
const { REST, Routes } = require("discord.js");
const commands = require("./commands");

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID) {
  console.error("Set DISCORD_TOKEN and CLIENT_ID in .env first.");
  process.exit(1);
}
const rest = new REST().setToken(DISCORD_TOKEN);
const route = GUILD_ID
  ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID) // shows up instantly in that one server
  : Routes.applicationCommands(CLIENT_ID);                // every server, can take a while to appear

rest.put(route, { body: commands })
  .then(() => console.log(`Registered ${commands.length} commands ${GUILD_ID ? "to your server" : "globally"}.`))
  .catch((e) => { console.error(e); process.exit(1); });
