# 2Kreate Discord Bot

Brings 2Kreate's builds, badges and events into Discord as slash commands.

| Command | What it does |
|---|---|
| `/build` | A build's OVR, body, attributes (with caps) and every badge it unlocks by tier |
| `/builds` | List all builds, or filter by PG, SG, SF, PF, C or your own |
| `/badge` | What a badge needs for Bronze through Hall of Fame. Add a build to see how close it is |
| `/tweak` | Change attributes on a build (like `FT 60, DD 85`) and see the OVR and which badges go up or down |
| `/compare` | Two builds side by side: attribute differences and which badges each one does better |
| `/events` | What's live now and what's coming up, with countdowns |

Build, badge and attribute names autocomplete as you type.

## Setup (about 10 minutes)

1. **Install Node.js 18 or newer** from nodejs.org.
2. **Make the bot in Discord.** Go to discord.com/developers/applications → New Application → name it 2Kreate.
   - **Bot** tab → Reset Token → copy it. That's your `DISCORD_TOKEN`.
   - **General Information** tab → copy the Application ID. That's your `CLIENT_ID`.
3. **Invite it to your server.** OAuth2 tab → URL Generator → tick `bot` and `applications.commands` → under Bot Permissions tick `Send Messages` and `Embed Links` → open the link it makes and pick your server.
4. **Fill in settings.** In this folder, copy `.env.example` to `.env` and paste in your token and client ID. For testing, also add your server ID as `GUILD_ID` (turn on Developer Mode in Discord settings, then right-click your server → Copy Server ID) so commands show up right away.
5. **Run it.** In a terminal in this folder:
   ```
   npm install
   npm run deploy
   npm start
   ```
   You should see "2Kreate bot is online". Type `/` in your server.

`npm run deploy` only needs running again if the commands themselves change. The bot only runs while `npm start` is running, so to keep it online 24/7 put it on a host like Railway, Render or a cheap VPS (same three commands, and set the `.env` values in the host's settings).

## Keeping it in sync with the app

The bot reads builds, badges, caps and the OVR math straight out of `index.html`. When you change the app, copy your new `index.html` and `events.json` into this folder, replacing the old ones, and restart the bot. Nothing else to edit.

For events, you can also set `EVENTS_URL` to your Worker's `/events.json` address, and the bot will pull the live list every time someone runs `/events`.
