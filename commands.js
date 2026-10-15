const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");

const build = (o, name = "build", desc = "Pick a build") =>
  o.setName(name).setDescription(desc).setRequired(true).setAutocomplete(true);
const code = (o) => o.setName("code").setDescription("Like 2K-ABCD-2345").setRequired(true).setMaxLength(20);

module.exports = [
  new SlashCommandBuilder().setName("build").setDescription("Show a build: OVR, attributes and every badge it unlocks")
    .addStringOption((o) => build(o)),
  new SlashCommandBuilder().setName("builds").setDescription("List the builds")
    .addStringOption((o) => o.setName("position").setDescription("Filter by position").addChoices(
      { name: "PG", value: "PG" }, { name: "SG", value: "SG" }, { name: "SF", value: "SF" },
      { name: "PF", value: "PF" }, { name: "C", value: "C" }, { name: "My builds", value: "MINE" })),
  new SlashCommandBuilder().setName("badge").setDescription("What a badge needs at each tier")
    .addStringOption((o) => o.setName("name").setDescription("Badge").setRequired(true).setAutocomplete(true))
    .addStringOption((o) => o.setName("build").setDescription("Also show how close a build is").setAutocomplete(true)),
  new SlashCommandBuilder().setName("tweak").setDescription("Change attributes on a build and see the OVR and badge changes")
    .addStringOption((o) => build(o))
    .addStringOption((o) => o.setName("changes").setDescription('Like "FT 60, DD 85" or "Free Throw 60, Driving Dunk 85"').setRequired(true)),
  new SlashCommandBuilder().setName("compare").setDescription("Put two builds side by side")
    .addStringOption((o) => build(o, "a", "First build"))
    .addStringOption((o) => build(o, "b", "Second build")),
  new SlashCommandBuilder().setName("builder").setDescription("Make your own build with menus and buttons")
    .addStringOption((o) => o.setName("body").setDescription("Start from this build's body and caps (blank PG 6'5\" if empty)").setAutocomplete(true)),
  new SlashCommandBuilder().setName("events").setDescription("Current and upcoming 2K events"),
  new SlashCommandBuilder().setName("redeem").setDescription("Unlock 2Kreate Pro with your code")
    .addStringOption(code),
  new SlashCommandBuilder().setName("pro").setDescription("Make and manage 2Kreate Pro codes (admins only)")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((s) => s.setName("make").setDescription("Make new codes to sell or give away")
      .addStringOption((o) => o.setName("plan").setDescription("How long it lasts").setRequired(true).addChoices(
        { name: "30 days", value: "month" }, { name: "Season pass", value: "season" },
        { name: "7 days", value: "week" }, { name: "Lifetime", value: "life" }))
      .addStringOption((o) => o.setName("note").setDescription("Who it's for, like their name or Cash App tag").setMaxLength(60))
      .addIntegerOption((o) => o.setName("count").setDescription("How many codes (1 to 20)").setMinValue(1).setMaxValue(20)))
    .addSubcommand((s) => s.setName("list").setDescription("Your newest codes and whether they're used"))
    .addSubcommand((s) => s.setName("info").setDescription("Look up one code").addStringOption(code))
    .addSubcommand((s) => s.setName("off").setDescription("Turn a code off everywhere").addStringOption(code))
    .addSubcommand((s) => s.setName("on").setDescription("Turn a code back on").addStringOption(code))
    .addSubcommand((s) => s.setName("reset").setDescription("Clear a code's devices so it can move to a new phone").addStringOption(code)),
].map((c) => c.toJSON());
