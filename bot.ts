import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  GatewayIntentBits,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  TextChannel,
} from "discord.js";
import { logger } from "./lib/logger";

const SESSION_PING = "<@&1519376326736216165>";
const LOGO_URL = process.env["REPLIT_DEV_DOMAIN"]
  ? `https://${process.env["REPLIT_DEV_DOMAIN"]}/api/logo.png`
  : null;

const WELCOME_MESSAGE = (member: string) =>
  `Howdy, ${member} Welcome to **Houston Texas Roleplay**! We hope you enjoy your stay! <:htxrp:1519359331588636682>`;

const DISCORD_RULE_FIELDS = [
  {
    name: "§1 — Respect Everyone",
    value:
      "Harassment, hate speech, racism, or discrimination of any kind will result in an immediate ban.",
  },
  {
    name: "§2 — No Spamming",
    value: "Do not flood channels with repeated messages, images, or emotes.",
  },
  {
    name: "§3 — Stay in the Right Channel",
    value:
      "Use channels for their intended purpose. Off-topic content belongs in the appropriate channel.",
  },
  {
    name: "§4 — No NSFW Content",
    value:
      "Explicit or inappropriate content of any kind is strictly prohibited.",
  },
  {
    name: "§5 — No Advertising",
    value:
      "Do not promote other Discord servers, social media, or services without staff approval.",
  },
  {
    name: "§6 — Follow Discord's ToS",
    value:
      "All members must comply with [Discord's Terms of Service](https://discord.com/terms) at all times.",
  },
  {
    name: "§7 — Listen to Staff",
    value:
      "Staff decisions are final. Disagreements should be handled through a support ticket, not in public channels.",
  },
  {
    name: "§8 — No Doxxing",
    value:
      "Sharing another member's personal information without their consent is an instant permanent ban.",
  },
];

const GAME_RULE_FIELDS = [
  {
    name: "§1 — No RDM",
    value:
      "Random Deathmatch is not allowed. You must have a valid in-character reason before harming another player.",
  },
  {
    name: "§2 — No VDM",
    value:
      "Using a vehicle as a weapon without a proper RP reason is strictly forbidden.",
  },
  {
    name: "§3 — Value Your Life",
    value:
      "Act realistically. Do not take unnecessary risks when your life is on the line.",
  },
  {
    name: "§4 — New Life Rule",
    value:
      "After dying, you forget all events leading up to your death. Do not return to the scene of your death.",
  },
  {
    name: "§5 — No Metagaming",
    value:
      "Do not use out-of-character information to influence in-character decisions.",
  },
  {
    name: "§6 — No Powergaming",
    value:
      "Do not force unrealistic actions on other players or exploit mechanics in unintended ways.",
  },
  {
    name: "§7 — Stay In Character",
    value:
      "Keep OOC chat to a minimum and use only designated channels for out-of-character communication.",
  },
  {
    name: "§8 — No Cop Baiting",
    value:
      "Deliberately provoking law enforcement without a valid RP reason is not permitted.",
  },
  {
    name: "§9 — Respect All Players",
    value:
      "Treat every player with respect both in and out of character at all times.",
  },
  {
    name: "§10 — Staff Ride-Alongs",
    value:
      "If staff is observing your RP session, continue naturally. Do not break immersion or acknowledge their presence.",
  },
];

const COMMANDS = [
  new SlashCommandBuilder()
    .setName("setup-tickets")
    .setDescription("Post the support panel in the configured channel")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("setup-rules")
    .setDescription("Post the rules panel in the configured rules channel")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("setup-shop")
    .setDescription("Post the shop embed in the configured channel")
    .toJSON(),
  new SlashCommandBuilder()
    .setName("session-vote")
    .setDescription("Post a session vote in a channel")
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Channel to post in")
        .setRequired(true),
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName("session-start")
    .setDescription("Announce that the session has started")
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Channel to post in")
        .setRequired(true),
    )
    .toJSON(),
  new SlashCommandBuilder()
    .setName("session-down")
    .setDescription("Announce that the session has ended")
    .addChannelOption((opt) =>
      opt
        .setName("channel")
        .setDescription("Channel to post in")
        .setRequired(true),
    )
    .toJSON(),
];

const sessionStartTimes = new Map<string, number>();
const voteData = new Map<
  string,
  { yes: number; no: number; voters: Set<string> }
>();

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function buildPermissions(
  guildId: string,
  userId: string,
  staffRoleId?: string,
) {
  const overwrites: any[] = [
    { id: guildId, deny: [PermissionsBitField.Flags.ViewChannel] },
    {
      id: userId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
      ],
    },
  ];
  if (staffRoleId) {
    overwrites.push({
      id: staffRoleId,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.ManageMessages,
      ],
    });
  }
  return overwrites;
}

export function startBot() {
  const token = process.env["DISCORD_BOT_TOKEN"];
  const welcomeChannelId = process.env["DISCORD_WELCOME_CHANNEL_ID"];
  const ticketChannelId = process.env["DISCORD_TICKET_CHANNEL_ID"];
  const staffRoleId = process.env["DISCORD_STAFF_ROLE_ID"];
  const rulesChannelId = process.env["DISCORD_RULES_CHANNEL_ID"];
  const shopChannelId = process.env["DISCORD_SHOP_CHANNEL_ID"];

  if (!token) {
    logger.error("DISCORD_BOT_TOKEN is not set — bot will not start");
    return;
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildMessages,
    ],
  });

  client.once(Events.ClientReady, async (readyClient) => {
    logger.info({ tag: readyClient.user.tag }, "Discord bot is online");
    const rest = new REST().setToken(token);
    try {
      await rest.put(Routes.applicationCommands(readyClient.user.id), {
        body: COMMANDS,
      });
      logger.info("Slash commands registered");
    } catch (err) {
      logger.error({ err }, "Failed to register slash commands");
    }
  });

  client.on(Events.GuildMemberAdd, async (member) => {
    try {
      await member.roles.add("1519361766734303365");
      logger.info({ userId: member.id }, "Assigned member role");
    } catch (err) {
      logger.error({ err }, "Failed to assign member role");
    }
    if (!welcomeChannelId) return;
    try {
      const channel = await client.channels.fetch(welcomeChannelId);
      if (!channel || !(channel instanceof TextChannel)) return;
      await channel.send(WELCOME_MESSAGE(`${member}`));
      logger.info({ userId: member.id }, "Sent welcome message");
    } catch (err) {
      logger.error({ err }, "Failed to send welcome message");
    }
  });

  client.on(Events.InteractionCreate, async (interaction) => {
    // ── Slash commands ──────────────────────────────────────────────────────
    if (interaction.isChatInputCommand()) {
      // /setup-tickets
      if (interaction.commandName === "setup-tickets") {
        if (!ticketChannelId) {
          await interaction.reply({
            content: "DISCORD_TICKET_CHANNEL_ID is not configured.",
            ephemeral: true,
          });
          return;
        }
        const channel = await client.channels
          .fetch(ticketChannelId)
          .catch(() => null);
        if (!channel || !(channel instanceof TextChannel)) {
          await interaction.reply({
            content: "Ticket channel not found or is not a text channel.",
            ephemeral: true,
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0xe63946)
          .setTitle(
            "<:htxrp:1519359331588636682>  Houston Texas Roleplay Support",
          )
          .setDescription(
            "Need a hand or want to join the team? Select an option below.\n\n" +
              "**Please keep in mind:**\n" +
              "— Ban Appeals are handled separately and do not belong here\n" +
              "— Spam tickets will be closed without response\n\n" +
              "Provide as much detail as possible so staff can assist you quickly.",
          )
          .setThumbnail(LOGO_URL)
          .setFooter({
            text: "Houston Texas Roleplay — Tickets are monitored by staff. Please be patient.",
          });

        const menu = new StringSelectMenuBuilder()
          .setCustomId("support_type_select")
          .setPlaceholder("Make a selection")
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel("General Support")
              .setDescription(
                "Questions, in-game issues, or general assistance",
              )
              .setValue("general_support")
              .setEmoji("🎫"),
            new StringSelectMenuOptionBuilder()
              .setLabel("Staff Application")
              .setDescription(
                "Apply to join the Houston Texas Roleplay staff team",
              )
              .setValue("staff_application")
              .setEmoji("📝"),
          );

        const row =
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
        await channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({
          content: `Support panel posted in <#${ticketChannelId}>!`,
          ephemeral: true,
        });
        return;
      }

      // /setup-rules
      if (interaction.commandName === "setup-rules") {
        if (!rulesChannelId) {
          await interaction.reply({
            content: "DISCORD_RULES_CHANNEL_ID is not configured.",
            ephemeral: true,
          });
          return;
        }
        const channel = await client.channels
          .fetch(rulesChannelId)
          .catch(() => null);
        if (!channel || !(channel instanceof TextChannel)) {
          await interaction.reply({
            content: "Rules channel not found or is not a text channel.",
            ephemeral: true,
          });
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0xe63946)
          .setTitle(
            "<:htxrp:1519359331588636682> | Houston Texas Roleplay Rules",
          )
          .setDescription(
            "Welcome to **Houston Texas Roleplay**.\n\n" +
              "All members are expected to follow the rules at all times. " +
              "Select a category below to read the full ruleset.",
          )
          .setThumbnail(LOGO_URL)
          .setFooter({
            text: "Houston Texas Roleplay  •  Ignorance of the rules is not an excuse.",
          });

        const menu = new StringSelectMenuBuilder()
          .setCustomId("rules_select")
          .setPlaceholder("Make a selection")
          .addOptions(
            new StringSelectMenuOptionBuilder()
              .setLabel("Discord Rules")
              .setDescription(
                "Community and conduct rules for this Discord server",
              )
              .setValue("discord_rules")
              .setEmoji("📋"),
            new StringSelectMenuOptionBuilder()
              .setLabel("Game Rules")
              .setDescription(
                "In-game roleplay rules you must follow at all times",
              )
              .setValue("game_rules")
              .setEmoji("🎮"),
          );

        const row =
          new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
        await channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({
          content: `Rules panel posted in <#${rulesChannelId}>!`,
          ephemeral: true,
        });
        return;
      }

      // /setup-shop
      if (interaction.commandName === "setup-shop") {
        if (!shopChannelId) {
          await interaction.reply({
            content: "DISCORD_SHOP_CHANNEL_ID is not configured.",
            ephemeral: true,
          });
          return;
        }
        const channel = await client.channels
          .fetch(shopChannelId)
          .catch(() => null);
        if (!channel || !(channel instanceof TextChannel)) {
          await interaction.reply({
            content: "Shop channel not found or is not a text channel.",
            ephemeral: true,
          });
          return;
        }

        const TICKET_URL =
          "https://discord.com/channels/1519347594327883868/1519353549107105922";

        const embed = new EmbedBuilder()
          .setColor(0xe63946)
          .setTitle(
            "<:htxrp:1519359331588636682> | Houston Texas Roleplay Shop",
          )
          .setDescription(
            "Welcome to the **Houston Texas Roleplay** shop!\n\n" +
              "All purchases are handled through our support team. " +
              `To buy anything listed below, [open a ticket here](${TICKET_URL}) and let staff know what you'd like.`,
          )
          .addFields(
            {
              name: "💸  Server Donation",
              value:
                "Support the server and keep it running. Donors receive an exclusive in-game tag and Discord role as a thank you.",
              inline: false,
            },
            {
              name: "📢  Paid Advertisement",
              value:
                "Promote your business, department, or gang in our announcement channels. Reach the entire community with a pinned ad.",
              inline: false,
            },
            {
              name: "🎨  Custom Role",
              value:
                "Get a custom colored role with your name or brand on it. Displayed above regular member roles.",
              inline: false,
            },
            {
              name: "🚗  Priority Whitelist",
              value:
                "Skip the queue and get priority access when the server is full during high-traffic sessions.",
              inline: false,
            },
            {
              name: "\u200b",
              value: `> **Ready to purchase?** [Click here to open a ticket](${TICKET_URL})`,
              inline: false,
            },
          )
          .setThumbnail(LOGO_URL)
          .setFooter({
            text: "Houston Texas Roleplay  •  All sales are final. No refunds.",
          });

        await channel.send({ embeds: [embed] });
        await interaction.reply({
          content: `Shop embed posted in <#${shopChannelId}>!`,
          ephemeral: true,
        });
        logger.info({ userId: interaction.user.id }, "Shop embed posted");
        return;
      }

      // /session-vote
      if (interaction.commandName === "session-vote") {
        const channel = interaction.options.getChannel("channel", true);
        const target = await client.channels
          .fetch(channel.id)
          .catch(() => null);
        if (!target || !(target instanceof TextChannel)) {
          await interaction.reply({
            content: "That channel is not a text channel.",
            ephemeral: true,
          });
          return;
        }

        const voteEmbed = new EmbedBuilder()
          .setColor(0xe63946)
          .setTitle("<:htxrp:1519359331588636682>  Session Vote")
          .setDescription(
            "**Should we start a session?**\n\n" +
              "Vote below so management can see if there's enough interest to spin up the server.\n\n" +
              "We need enough votes before a session can be called.",
          )
          .addFields(
            { name: "✅  Yes", value: "0 votes", inline: true },
            { name: "❌  No", value: "0 votes", inline: true },
          )
          .setThumbnail(LOGO_URL)
          .setFooter({
            text: `Vote called by ${interaction.user.username}  •  Houston Texas Roleplay`,
          })
          .setTimestamp();

        const yesBtn = new ButtonBuilder()
          .setCustomId("vote_yes")
          .setLabel("Yes")
          .setStyle(ButtonStyle.Success)
          .setEmoji("✅");
        const noBtn = new ButtonBuilder()
          .setCustomId("vote_no")
          .setLabel("No")
          .setStyle(ButtonStyle.Danger)
          .setEmoji("❌");
        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          yesBtn,
          noBtn,
        );

        const msg = await target.send({
          content: SESSION_PING,
          embeds: [voteEmbed],
          components: [row],
        });
        voteData.set(msg.id, { yes: 0, no: 0, voters: new Set() });
        await interaction.reply({
          content: `Session vote posted in <#${channel.id}>!`,
          ephemeral: true,
        });
        logger.info({ userId: interaction.user.id }, "Session vote posted");
        return;
      }

      // /session-start
      if (interaction.commandName === "session-start") {
        const channel = interaction.options.getChannel("channel", true);
        const target = await client.channels
          .fetch(channel.id)
          .catch(() => null);
        if (!target || !(target instanceof TextChannel)) {
          await interaction.reply({
            content: "That channel is not a text channel.",
            ephemeral: true,
          });
          return;
        }

        const guildId = interaction.guildId ?? "global";
        sessionStartTimes.set(guildId, Date.now());

        const embed = new EmbedBuilder()
          .setColor(0x2ecc71)
          .setTitle("<:htxrp:1519359331588636682>  Session Started")
          .setDescription(
            "**The Houston Texas Roleplay server is now live!**\n\n" +
              "Get in, gear up, and keep it professional out there.\n\n" +
              "Joining the server while a session is **not** active will result in moderation action.",
          )
          .addFields(
            {
              name: "Session started by",
              value: `${interaction.user}`,
              inline: true,
            },
            { name: "ERLC Server Code", value: "**TXSrpX**", inline: true },
          )
          .setThumbnail(LOGO_URL)
          .setFooter({
            text: "Houston Texas Roleplay  •  See you in the city!",
          })
          .setTimestamp();

        await target.send({ content: SESSION_PING, embeds: [embed] });
        await interaction.reply({
          content: `Session start announced in <#${channel.id}>!`,
          ephemeral: true,
        });
        logger.info({ userId: interaction.user.id }, "Session started");
        return;
      }

      // /session-down
      if (interaction.commandName === "session-down") {
        const channel = interaction.options.getChannel("channel", true);
        const target = await client.channels
          .fetch(channel.id)
          .catch(() => null);
        if (!target || !(target instanceof TextChannel)) {
          await interaction.reply({
            content: "That channel is not a text channel.",
            ephemeral: true,
          });
          return;
        }

        const guildId = interaction.guildId ?? "global";
        const startTime = sessionStartTimes.get(guildId);
        const duration = startTime
          ? formatDuration(Date.now() - startTime)
          : "Unknown";
        sessionStartTimes.delete(guildId);

        const embed = new EmbedBuilder()
          .setColor(0xe63946)
          .setTitle("<:htxrp:1519359331588636682>  Server Shutdown")
          .setDescription(
            "The **Houston Texas Roleplay** management has decided to shut down the server.\n\n" +
              "Joining while a session is not active **WILL** get you moderated.\n\n" +
              "If you were not kicked automatically, please leave the server. Thanks for playing and roleplaying.",
          )
          .addFields(
            { name: "Session duration", value: duration, inline: true },
            {
              name: "Session ended by",
              value: `${interaction.user}`,
              inline: true,
            },
          )
          .setThumbnail(LOGO_URL)
          .setFooter({
            text: "Houston Texas Roleplay  •  See you next session!",
          })
          .setTimestamp();

        await target.send({ embeds: [embed] });
        await interaction.reply({
          content: `Session down announced in <#${channel.id}>!`,
          ephemeral: true,
        });
        logger.info({ userId: interaction.user.id, duration }, "Session ended");
        return;
      }
    }

    // ── Select menus ────────────────────────────────────────────────────────
    if (interaction.isStringSelectMenu()) {
      // Rules dropdown
      if (interaction.customId === "rules_select") {
        const selected = interaction.values[0];
        if (selected === "discord_rules") {
          const embed = new EmbedBuilder()
            .setColor(0xe63946)
            .setTitle("📋  Discord Rules")
            .setDescription(
              "The following rules apply to all members inside this Discord server at all times.",
            )
            .addFields(DISCORD_RULE_FIELDS)
            .setFooter({
              text: "Houston Texas Roleplay  •  Breaking these rules has consequences.",
            });
          await interaction.reply({ embeds: [embed], ephemeral: true });
          return;
        }
        if (selected === "game_rules") {
          const embed = new EmbedBuilder()
            .setColor(0xe63946)
            .setTitle("🎮  Game Rules")
            .setDescription(
              "The following rules apply to all players inside the server at all times.",
            )
            .addFields(GAME_RULE_FIELDS)
            .setFooter({
              text: "Houston Texas Roleplay  •  Fair play keeps the server alive.",
            });
          await interaction.reply({ embeds: [embed], ephemeral: true });
          return;
        }
      }

      // Support type dropdown
      if (interaction.customId === "support_type_select") {
        if (!interaction.guild) return;
        const selected = interaction.values[0];
        const isApplication = selected === "staff_application";

        const channelName = isApplication
          ? `application-${interaction.user.username.toLowerCase()}`
          : `ticket-${interaction.user.username.toLowerCase()}`;

        const existing = interaction.guild.channels.cache.find(
          (ch) => ch.name === channelName,
        );
        if (existing) {
          await interaction.reply({
            content: `You already have an open ${isApplication ? "application" : "ticket"}: <#${existing.id}>`,
            ephemeral: true,
          });
          return;
        }

        const ticketChannel = await interaction.guild.channels.create({
          name: channelName,
          type: ChannelType.GuildText,
          permissionOverwrites: buildPermissions(
            interaction.guild.roles.everyone.id,
            interaction.user.id,
            staffRoleId,
          ),
          topic: isApplication
            ? `Staff application from ${interaction.user.tag}`
            : `Support ticket for ${interaction.user.tag}`,
        });

        const embed = isApplication
          ? new EmbedBuilder()
              .setColor(0xe63946)
              .setTitle("Staff Application")
              .setDescription(
                `Welcome, ${interaction.user}!\n\n` +
                  "Thanks for your interest in joining the **Houston Texas Roleplay** staff team.\n\n" +
                  "Please answer the following in your own words:\n" +
                  "**1.** What is your age?\n" +
                  "**2.** How long have you been on the server?\n" +
                  "**3.** What position are you applying for?\n" +
                  "**4.** Why do you want to be staff?\n" +
                  "**5.** Do you have any prior moderation experience?\n\n" +
                  "A staff member will review your application shortly.",
              )
              .setFooter({
                text: "Houston Texas Roleplay  •  Applications are reviewed by management.",
              })
              .setTimestamp()
          : new EmbedBuilder()
              .setColor(0xe63946)
              .setTitle("Support Ticket")
              .setDescription(
                `Welcome, ${interaction.user}!\n\n` +
                  "Please describe your issue in as much detail as possible and a staff member will be with you shortly.\n\n" +
                  "**When you're done, click the button below to close this ticket.**",
              )
              .setFooter({ text: "Houston Texas Roleplay Support" })
              .setTimestamp();

        const closeButton = new ButtonBuilder()
          .setCustomId("close_ticket")
          .setLabel("Close Ticket")
          .setStyle(ButtonStyle.Danger);
        const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
          closeButton,
        );

        await ticketChannel.send({
          content: staffRoleId ? `<@&${staffRoleId}>` : "",
          embeds: [embed],
          components: [closeRow],
        });

        await interaction.reply({
          content: `Your ${isApplication ? "application" : "ticket"} has been created: <#${ticketChannel.id}>`,
          ephemeral: true,
        });
        logger.info(
          {
            userId: interaction.user.id,
            type: selected,
            channelId: ticketChannel.id,
          },
          "Support channel opened",
        );
        return;
      }
    }

    // ── Buttons ─────────────────────────────────────────────────────────────
    if (interaction.isButton()) {
      if (
        interaction.customId === "vote_yes" ||
        interaction.customId === "vote_no"
      ) {
        const msgId = interaction.message.id;
        if (!voteData.has(msgId)) {
          await interaction.reply({
            content: "This vote has expired.",
            ephemeral: true,
          });
          return;
        }
        const data = voteData.get(msgId)!;
        if (data.voters.has(interaction.user.id)) {
          await interaction.reply({
            content: "You have already voted!",
            ephemeral: true,
          });
          return;
        }
        data.voters.add(interaction.user.id);
        if (interaction.customId === "vote_yes") data.yes++;
        else data.no++;

        const updatedEmbed = EmbedBuilder.from(
          interaction.message.embeds[0],
        ).setFields(
          {
            name: "✅  Yes",
            value: `${data.yes} vote${data.yes !== 1 ? "s" : ""}`,
            inline: true,
          },
          {
            name: "❌  No",
            value: `${data.no} vote${data.no !== 1 ? "s" : ""}`,
            inline: true,
          },
        );

        await interaction.update({ embeds: [updatedEmbed] });
        return;
      }

      if (interaction.customId === "close_ticket") {
        if (!interaction.channel) return;
        await interaction.reply({ content: "Closing in 5 seconds..." });
        setTimeout(async () => {
          try {
            await interaction.channel?.delete();
            logger.info(
              { channelId: interaction.channelId },
              "Ticket/application closed",
            );
          } catch (err) {
            logger.error({ err }, "Failed to close channel");
          }
        }, 5000);
        return;
      }
    }
  });

  client.login(token).catch((err) => {
    if (err?.message?.includes("disallowed intents")) {
      logger.error(
        "Discord login failed: Server Members Intent not enabled. Enable it in the Discord Developer Portal.",
      );
    } else {
      logger.error({ err }, "Failed to log in to Discord");
    }
  });
}
