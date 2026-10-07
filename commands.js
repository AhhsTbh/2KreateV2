const { SlashCommandBuilder } = require("discord.js");

const build = (o, name = "build", desc = "Pick a build") =>
  o.setName(name).setDescription(desc).setRequired(true).setAutocomplete(true);

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
  new SlashCommandBuilder().setName("events").setDescription("Current and upcoming 2K events"),
].map((c) => c.toJSON());
