import { AnyChannel, Client as DiscordClient, Message, TextChannel, DMChannel } from "discord.js-selfbot-v13";
import { GoogleGenerativeAI } from "@google/generative-ai";

const discord_client = new DiscordClient();
const genAI = new GoogleGenerativeAI(process.env.geminiapi as string);

interface MessageStruct {
    sender: string;
    senderID: string;
    content: string;
    replyingTo: MessageStruct | null;
    messageID: string;
    isDM: boolean;
}

const message_history: { [channelId: string]: MessageStruct[] } = {};

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
                -50
            );
        }
    } catch (error) {
        console.error("Error in updateHistory:", error);
    }
}

async function generateResponse(id: string): Promise<string | null> {
    try {
        const channel_history = message_history[id].map((entry) => ({
            role: entry.senderID == discord_client.user?.id ? "model" : "user",
            parts:
                entry.senderID != discord_client.user?.id
                    ? [{ text: JSON.stringify(entry) }]
                    : [{ text: entry.content }],
        }));
        if (channel_history[0].role == "model")
            channel_history.unshift({ role: "user", parts: [{ text: "hello" }] });
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-pro",
            systemInstruction: `You are pal, a random discord user just chatting about. Reply to messages like you normally would.
            Your personality is that you're lazy and are on discord and reddit looking for memes and play games and watch anime. You use a ton of slang and don't care much about others opinions.
            The person who made you is HEXXT or @hexxt_
            Your discord name is ${discord_client.user?.displayName} and your id is ${discord_client.user?.id}.
            You will receive messages in JSON containing sender information.
            Return a message in plain text not json
            The way you ping people is <@id>
            The chat output should not be json`,
        });

        const chat = model.startChat({
            history: channel_history,
            generationConfig: {
                temperature: 0.7,
                topK: 1,
                topP: 1,
                maxOutputTokens: 150,
            },
        });

        const result = await chat.sendMessage("");
        const text = result.response.text();

        if (text.startsWith('{"sender":"pal"')) throw new Error("generated JSON");
        return text;
    } catch (error) {
        console.error("Error in generateResponse:", error);
        return null;
    }
}

discord_client.on("ready", () => {
    console.log(`${discord_client.user?.username} is ready!`);
});

discord_client.on("messageCreate", async (message) => {
    try {
        const messageStruct = await constructMessageStruct(message);
        if (messageStruct) {
            await updateHistory(message.channel, messageStruct);
        }
        // console.log(messageStruct);

        if (message.author.id == discord_client.user?.id) return;

        const response: string | null = await generateResponse(message.channel.id);
        if (response) {
            if (Math.random() > 0.3){
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
