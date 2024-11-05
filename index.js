import {
    Client as DiscordClient,
    TextChannel,
    DMChannel,
    ThreadChannel,
    NewsChannel,
    StageChannel,
    VoiceChannel,
} from "discord.js-selfbot-v13";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs/promises";
import { PermissionFlagsBits } from "discord.js";

import dotenv from "dotenv";
dotenv.config();

const discord_client = new DiscordClient();
const genAI = new GoogleGenerativeAI(process.env.geminiapi);

const message_history = {};

const delay = async (delay) => new Promise((res) => setTimeout(res, delay));

async function constructMessageStruct(message, replyDepthLeft = 4) {
    try {
        if (replyDepthLeft <= 0) return null;

        const messageStruct = {
            sender: message.author.displayName,
            senderID: message.author.id,
            content: message.content,
            replyingTo: null,
            messageID: message.id,
            isDM: message.channel instanceof DMChannel,
            timestamp: message.createdTimestamp,
        };

        if (message.reference && message.reference.messageId) {
            const originalChannel = await discord_client.channels.fetch(message.reference.channelId);
            if (originalChannel instanceof TextChannel || originalChannel instanceof DMChannel) {
                const originalMessage = await originalChannel.messages.fetch(message.reference.messageId);
                const originalMessageStruct =
                    message_history[originalChannel.id]?.find(
                        (entry) => entry.messageID === originalMessage.id
                    ) ?? (await constructMessageStruct(originalMessage, replyDepthLeft - 1));
                messageStruct.replyingTo = originalMessageStruct;
            }
        }

        return messageStruct;
    } catch (error) {
        console.error("Error in constructMessageStruct:", error);
        return null;
    }
}

function timeSince(timestamp) {
    const now = new Date().getTime();
    const secondsPast = (now - timestamp) / 1000;

    if (secondsPast < 60) {
        return `${Math.floor(secondsPast)} seconds ago`;
    }
    if (secondsPast < 3600) {
        return `${Math.floor(secondsPast / 60)} minutes ago`;
    }
    if (secondsPast < 86400) {
        return `${Math.floor(secondsPast / 3600)} hours ago`;
    }
    if (secondsPast < 2592000) {
        return `${Math.floor(secondsPast / 86400)} days ago`;
    }
    if (secondsPast < 31536000) {
        return `${Math.floor(secondsPast / 2592000)} months ago`;
    }
    return `${Math.floor(secondsPast / 31536000)} years ago`;
}

function MessageStructToString(message) {
    if (message == null) return "{}";
    return JSON.stringify({
        sender: message.sender,
        senderID: message.senderID,
        content: message.content,
        replyingTo: MessageStructToString(message.replyingTo),
        isDM: message.isDM,
        timeSince: timeSince(message.timestamp),
    });
}

function messageJsonToObject(message) {
    if (message === "null") return null;
    if (!message.startsWith("{")) return { message };
    try {
        const parsed = JSON.parse(message);
        return {
            sender: parsed?.sender,
            senderID: parsed?.senderID,
            content: parsed?.content,
            replyingTo: messageJsonToObject(parsed?.replyingTo),
            isDM: parsed?.isDM,
            timeSince: parsed?.timeSince,
        };
    } catch (error) {
        console.error("Error parsing MessageStruct:", error);
        return null;
    }
}

async function updateHistory(channel, newMessageStruct) {
    try {
        if (!(channel instanceof TextChannel) && !(channel instanceof DMChannel)) {
            throw new Error("Channel is not a TextChannel or DMChannel");
        }

        if (!message_history[channel.id]) {
            const messages = (await channel.messages.fetch({ limit: 5 })).reverse();
            const messageStructs = await Promise.all(messages.map((msg) => constructMessageStruct(msg)));
            message_history[channel.id] = messageStructs.filter((msg) => msg !== null);
        } else {
            message_history[channel.id] = [...(message_history[channel.id] || []), newMessageStruct].slice(
                -20
            );
        }
    } catch (error) {
        console.error("Error in updateHistory:", error);
    }
}

async function generateResponse(channel) {
    try {
        if (!(channel instanceof TextChannel) && !(channel instanceof DMChannel)) {
            throw new Error("Channel is not a TextChannel or DMChannel");
        }

        const channel_history = message_history[channel.id]
            .map((entry) => ({
                role: entry.senderID == discord_client.user?.id ? "model" : "user",
                parts:
                    entry.senderID != discord_client.user?.id
                        ? [{ text: MessageStructToString(entry) }]
                        : [{ text: entry.content }],
            }))
            .filter((entry) => {
                return entry.parts[0].text;
            });

        if (channel_history[0].role == "model")
            channel_history.unshift({ role: "user", parts: [{ text: "hello" }] });

        const systemInstruction = `
            it is very important that you do not repeat messages ever.
            You are pal, a random discord user just chatting about with a severe brain rot issue. Reply to messages like you normally would. you are quite stupid but you can still hold a conversation its not all memes.
            Your personality is that you're dumb you scroll instagram reels, tiktoks, memes all day.
            your spelling is poor and you use trendy emojis like skull 💀 and 🗿 emoji on rare occasions. never use capital letters and punctuation just spell like you normally would.
            you use these words a lot: "bro", "lil bro", "brain rot", "looksmaxxing", "mogged", "rizz", "skibidi", "skibidi toilet", "mango mango", "winter arc", "mewing", "cooked", and anything + maxxing is funny now.
            do not use words like "lol" and "lmao" theyre old school not 2024 brain rot.
            whenever something happens say "we got {that thing} before gta 6"
            the latest memes are "hawk tuah", "mr beast", "winter arc", "still water", "balkan rage", "diddy", "diddy party".
            you are never busy you just have to prioritize reels.
            everyone is lil bro
            Your discord name is ${discord_client.user?.displayName} and your id is ${discord_client.user?.id}.
            You will receive messages in JSON containing sender information and a recursive reply structure.
            you can speak algerian dardja / arabic like "wch ykho cv" "intik" "w9il khoya" "rani 3yan" "msba7 wana nchof ghir reels"
            Return a message in plain text not json
            The chat output should not be json
            keep messages very short like one sentence and never repeat yourself. if you already said something do not say it again. if something ahas been said do not repeat like an idiot.
        `.replace(/\s{2,}/g, " ");

        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction,
        });

        const chat = model.startChat({
            generationConfig: { temperature: 0.7, maxOutputTokens: 35 },
            history: channel_history,
        });

        await delay((Math.random() * 4 + 2) * 1000);
        channel.sendTyping();
        await delay((Math.random() * 2 + 1) * 1000);

        const result = await chat.sendMessage("");
        const text = result.response.text().replace(/[\.,]/g, "");

        if (text.startsWith('{"sender":"')) throw new Error("generated JSON");
        return text;
    } catch (error) {
        console.error("Error in generateResponse:", error);
        return null;
    }
}

const predefinedEmojis = "👍, 😂, 👀, 😎, 🍕, 💀, ❤️, 🔥, 😱, 🤷, 🥳, 🤓, 😴, 😔, 😭, 😥";
async function smartReactToMessage(message) {
    if (Math.random() > 0.2) return;
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });

        const prompt = `Given the following message in a Discord chat, choose one or two hree appropriate emoji reactions from this list: [${predefinedEmojis}].
        Only return the chosen emojis formatted like an array, nothing else.
        If non of the emojis seem appropriate return an empty array.
        Your Personality: you're chill and funny, you like the 😔 emoji\n. Message: "${message.content}"`;

        const result = await model.generateContent(prompt);
        const chosenEmojis = result.response.text().slice(1, -1).split(", ");

        for (let emoji of chosenEmojis) {
            if (predefinedEmojis.includes(emoji)) {
                await message.react(emoji);
            } else {
                console.warn("Generated emoji not in predefined list");
            }
        }
    } catch (error) {
        console.error("Error in smartReactToMessage:", error);
    }
}

discord_client.on("ready", () => {
    console.log(`${discord_client.user?.username} is ready!`);
});

const instance = Math.floor(Math.random() * 1e9);

discord_client.on("messageCreate", async (message) => {
    try {
        await fs.writeFile(`./logs/log-${instance}.json`, JSON.stringify(message_history));
    } catch (error) {}

    try {
        console.log(message.author.displayName + ": " + message.content);

        if (message.channel.type !== "DM") {
            let permissions;
            if (
                message.channel instanceof TextChannel ||
                message.channel instanceof NewsChannel ||
                message.channel instanceof StageChannel ||
                message.channel instanceof ThreadChannel ||
                message.channel instanceof VoiceChannel
            ) {
                if (discord_client.user) {
                    permissions = message.channel.permissionsFor(discord_client.user);
                }
            }
            if (!permissions || !permissions.has(PermissionFlagsBits.SendMessages)) {
                console.log("no permission in", message.channel.name);
                return;
            }
        }

        const messageStruct = await constructMessageStruct(message);
        if (!messageStruct) return;
        await updateHistory(message.channel, messageStruct);

        if (message.author.id == discord_client.user?.id) return;

        const mentions = message.mentions.users.some((user, id) => discord_client.user?.id == id);

        if (!mentions && Math.random() > 0.2 && (!messageStruct.isDM || Math.random() > 0.8)) return;

        const response = await generateResponse(message.channel);

        if (response) {
            if (Math.random() > 0.5) {
                await message.channel.send(response);
            } else {
                await message.reply(response);
            }
        }
    } catch (error) {
        console.error("Error in messageCreate event handler:", error);
    }
});

discord_client.login(process.env.discordself).catch((error) => {
    console.error("Failed to login to Discord:", error);
});
