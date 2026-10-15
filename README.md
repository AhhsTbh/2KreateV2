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

Plus **2Kreate Pro** commands: `/redeem` for members, and `/pro make`, `/pro list`, `/pro info`, `/pro off`, `/pro on`, `/pro reset` for admins. See the Pro section below.

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

## 2Kreate Pro (codes)

Some tools in the app unlock with a code: Drills, Auto-loadout, Badge For Badge, Build around a stat, and My jumpers and Find my timing in the shot meter. Everything else stays free. The same code also gives the Pro role in Discord.

**How it works**

- You make codes in Discord with `/pro make`. They look like `2K-ABCD-2345` and come back in their own message so they're easy to copy.
- The buyer taps **Get Pro** in the app and types it in, or uses `/redeem` in Discord.
- A code works on 2 devices in the app plus one Discord account. The clock starts the first time it's used, not when you make it.
- Plans: 7 days, 30 days, Season pass (good until Sept 30, 2027), Lifetime.
- When a code expires or you turn it off, the app locks again the next time it checks in, and the bot takes the Pro role back within an hour.

| Admin command | What it does |
|---|---|
| `/pro make` | Make 1 to 20 codes. Add a note like the buyer's name or Cash App tag |
| `/pro list` | Your newest 15 codes and whether they're unused, active, expired or off |
| `/pro info` | Look up one code |
| `/pro off` / `/pro on` | Turn a code off everywhere, or back on |
| `/pro reset` | Clear a code's devices when someone gets a new phone |

**One-time setup**

1. **Netlify.** Site configuration → Environment variables → add `PRO_ADMIN_KEY` with a long random password (12+ characters). Then Deploys → Trigger deploy so the code checker picks it up.
2. **Discord.** Server Settings → Roles → make a role called `Pro`. Drag the 2Kreate bot's role above it, and make sure the bot's role has Manage Roles. With Developer Mode on, right-click the Pro role → Copy Role ID.
3. **Railway.** Variables → add `SITE_URL` (your Netlify address, like `https://your-site.netlify.app`), `PRO_ADMIN_KEY` (the same password as on Netlify) and `PRO_ROLE_ID` (the role ID you copied).

Optional settings:

| Where | Variable | What it does |
|---|---|---|
| Railway | `PRO_COMMANDS` | Which bot commands need Pro. Default `builder,tweak`. Use `none` to keep every command free |
| Railway | `PRO_BUY_URL` | Link shown when someone without Pro tries a Pro command |
| Netlify | `PRO_SEASON_END` | When Season pass codes end, like `2027-09-30` |
| Netlify | `PRO_MAX_DEVICES` | Devices per code in the app. Default 2 |

Until `PRO_ROLE_ID` is set, the bot keeps every command free and `/redeem` stays off, so nothing changes for your server before you're ready.

**Changing what's Pro in the app.** In `index.html`, any panel with `data-pro="Name"` is locked, and `data-pro-why` is its one-line pitch in the Get Pro sheet. Add or remove those to move a tool in or out of Pro. The price line and the "where to get a code" link are `PRO_PRICE` and `PRO_BUY`, near the bottom of the file.

The code checker is `netlify/functions/pro.mjs`. Codes are saved in Netlify Blobs (the `pro-codes` store), so there's no database to set up.

