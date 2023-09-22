require("dotenv").config();
const { Client, ChannelTypes, Permissions } = require("oceanic.js");
const BetterSqlite3 = require("better-sqlite3");
const { default: OpenAI } = require("openai");

const client = new Client({
    auth: `Bot ${process.env.TOKEN}`,
    gateway: {
        intents: 3276799,
        concurrency: "auto",
    },
});

const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY,
});

// db stuff
const db = new BetterSqlite3("bot.db");
db.prepare(
    `
    CREATE TABLE IF NOT EXISTS setupData (
        guildID TEXT PRIMARY KEY,
        channelID TEXT
    )
`
).run();

// setup and remove the ai
client.on("messageCreate", async (message) => {
    if (message.channel.type !== ChannelTypes.GUILD_TEXT)
        return await message.channel
            .createMessage({
                content: `You don't have the required permissions to run this command!`,
                messageReference: { messageID: message.id },
            })
            .catch((e) => {});

    const tokens = message.content.split(" ");
    if (tokens[0] === ".setupai") {
        if (!message.member.permissions.has(Permissions.ADMINISTRATOR)) return;

        try {
            let data = await db
                .prepare(`SELECT * FROM setupData WHERE guildID = ?`)
                .get(message.guild.id);
            if (!data) {
                db.prepare(
                    `INSERT INTO setupData (guildID, channelID) VALUES (?, ?)`
                ).run(message.guild.id, message.channel.id);
                await message.channel
                    .createMessage({
                        content: `Successfully setup AI in <#${message.channel.id}>`,
                        messageReference: { messageID: message.id },
                    })
                    .catch((e) => {});
                return;
            } else {
                await message.channel
                    .createMessage({
                        content: `You already have am AI system setup in <#${data.channelID}>`,
                        messageReference: { messageID: message.id },
                    })
                    .catch((e) => {});
                return;
            }
        } catch (err) {
            await message.channel
                .createMessage({
                    content: "An error has occurred. Try again later.",
                    messageReference: { messageID: message.id },
                })
                .catch((e) => {
                    return;
                });
            return;
        }
    } else if (tokens[0] === ".removeai") {
        await db
            .prepare(`DELETE FROM setupData WHERE guildID = ?`)
            .run(message.guild.id);
        await message.channel
            .createMessage({
                content: "Successfully removed the AI from this server.",
                messageReference: { messageID: message.id },
            })
            .catch((e) => {
                return;
            });
    } else {
        return;
    }
});

// main ai part
client.on("messageCreate", async (message) => {
    if (message.content.startsWith(".")) return;
    if (message.author.bot);

    let data = await db
        .prepare(`SELECT * FROM setupData WHERE guildID = ?`)
        .get(message.guild.id);
    if (!data) return;
    if (data.channelID !== message.channel.id) return;

    const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
            {
                role: "system",
                content:
                    "ChatGPT is a sarcastic, friendly, respectful and fun chatbot assistant.",
            },
            {
                role: "user",
                content: message.content,
            },
        ],
    });

    if (!response) {
        await message.channel
            .createMessage({
                content: `The OpenAI-API is currently not working with me. Try again later.`,
                messageReference: { messageID: message.id },
            })
            .catch((e) => {});
    } else {
        await message.channel
            .createMessage({
                content: response.choices[0].message.content,
                messageReference: { messageID: message.id },
            })
            .catch((e) => {});
    }
});

// catch client errors and log them
client.on("error", (err) => {
    console.error(err);
    return;
});

// basic ready event
client.on("ready", () => {
    console.log(`Ready! Logged in as ${client.user.tag}`);
});

client.connect();
