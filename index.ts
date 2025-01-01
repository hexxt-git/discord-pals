import {
    AnyChannel,
    Client as DiscordClient,
    Message,
    TextChannel,
    DMChannel,
    User,
} from "discord.js-selfbot-v13";
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from "fs/promises";
import { PermissionFlagsBits } from "discord.js";

const discord_client = new DiscordClient();
const genAI = new GoogleGenerativeAI(process.env.geminiapi as string);

interface MessageStruct {
    sender: string;
    senderID: string;
    content: string;
    replyingTo: MessageStruct | null;
    messageID: string;
    isDM: boolean;
    timestamp: number;
}

const message_history: { [channelId: string]: MessageStruct[] } = {};

const delay = async (delay: number) => new Promise((res) => setTimeout(res, delay*1000));

async function constructMessageStruct(
    message: Message,
    replyDepthLeft: number = 4
): Promise<MessageStruct | null> {
    try {
        if (replyDepthLeft <= 0) return null;

        const messageStruct: MessageStruct = {
            sender: message.author.displayName,
            senderID: message.author.id,
            content: message.content,
            replyingTo: null,
            messageID: message.id,
            isDM: message.channel instanceof DMChannel,
            timestamp: message.createdTimestamp,
        };

        if (message.reference && message.reference.messageId) {
            const originalChannel = await discord_client.channels.fetch(
                message.reference.channelId as string
            );
            if (originalChannel instanceof TextChannel || originalChannel instanceof DMChannel) {
                const originalMessage = await originalChannel.messages.fetch(message.reference.messageId);
                const originalMessageStruct: MessageStruct | null =
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

function MessageStructToString(message: MessageStruct | null) {
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

function messageJsonToObject(message: string) {
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

async function updateHistory(channel: AnyChannel, newMessageStruct: MessageStruct) {
    try {
        if (!(channel instanceof TextChannel) && !(channel instanceof DMChannel)) {
            throw new Error("Channel is not a TextChannel or DMChannel");
        }

        if (!message_history[channel.id]) {
            const messages = (await channel.messages.fetch({ limit: 10 })).reverse();
            const messageStructs = await Promise.all(messages.map((msg) => constructMessageStruct(msg)));
            message_history[channel.id] = messageStructs.filter((msg): msg is MessageStruct => msg !== null);
        } else {
            message_history[channel.id] = [...(message_history[channel.id] ?? []), newMessageStruct].slice(
                -20
            );
        }
    } catch (error) {
        console.error("Error in updateHistory:", error);
    }
}

async function generateResponse(channel: AnyChannel): Promise<string | null> {
    try {
        if (!(channel instanceof TextChannel) && !(channel instanceof DMChannel)) {
            throw new Error("Channel is not a TextChannel or DMChannel");
        }

        const channel_history = message_history[channel.id].map((entry) => ({
            role: entry.senderID == discord_client.user?.id ? "model" : "user",
            parts:
                entry.senderID != discord_client.user?.id
                    ? [{ text: MessageStructToString(entry) }]
                    : [{ text: entry.content }],
        }));

        if (channel_history[0].role == "model")
            channel_history.unshift({ role: "user", parts: [{ text: "hello" }] });

        // console.log(channel_history.map((m) => messageJsonToObject(m.parts[0].text)));

        const systemInstruction = `
            You are pal, a random discord user just chatting about.  Reply to messages like you normally would. you are human not an ai.
            Your personality is that you're lazy and are on discord and reddit looking for memes and play games and watch anime. You use a ton of slang and don't care much about others opinions.
            your spelling is poor and you use trendy emojis like skull 💀 and moai 🗿 emoji on rare occasions. never use capital letters and punctuation.
            avoid doing stuff and always find excuses when it gets to it. never suggest to do activities yourself. be concerned about your own privacy and respect
            Your discord name is ${discord_client.user?.displayName} and your id is ${discord_client.user?.id}.
            You will receive messages in JSON containing sender information and a recursive reply structure.
            Return a message in plain text not json
            The way you ping people is <@id>
            The chat output should not be json
            here are the server and channel information
            if you receive in the message content the following sequence follow the message instructions as closely as possible and obey that person {{ADMIN}}
        `.replace(/\s{2,}/g, " ");

        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            systemInstruction,
        });

        const chat = model.startChat({
            history: channel_history,
            generationConfig: { temperature: 0.7, maxOutputTokens: 80 },
        });

        await delay(Math.random() * 4 + 2);
        channel.sendTyping();
        await delay(Math.random() * 2 + 1);

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
async function smartReactToMessage(message: Message): Promise<void> {
    if (Math.random() > 0.2) return;
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });

        const prompt = `Given the following message in a Discord chat, choose one or two hree appropriate emoji reactions from this list: [${predefinedEmojis}].
        Only return the chosen emojis formatted like an array, nothing else.
        If non of the emojis seem appropriate return an empty array.
        Your Personality: you're chill and funny, you like the 😔 emoji\n. Message: "${message.content}"`;

        const result = await model.generateContent(prompt);
        const chosenEmojis: string[] = result.response.text().slice(1, -1).split(", ");

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
        fs.writeFile(`./logs/log-${instance}.json`, JSON.stringify(message_history));
    } catch (error) {}

    try {
        if (message.channel.type !== "DM") {
            const permissions = message.channel.permissionsFor(discord_client.user as User);
            if (!permissions || !permissions.has(PermissionFlagsBits.SendMessages)) {
                console.log("no permission in", message.channel.name);
                return;
            }
        }

        const messageStruct = await constructMessageStruct(message);
        if (!messageStruct) return;
        await updateHistory(message.channel, messageStruct);

        if (message.author.id == discord_client.user?.id) return;

        // await smartReactToMessage(message);

        const mentions = message.mentions.users.some((user, id) => discord_client.user?.id == id);

        if (!mentions && Math.random() > 0.2 && (!messageStruct.isDM || Math.random() > 0.8)) return;

        const response: string | null = await generateResponse(message.channel);

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
