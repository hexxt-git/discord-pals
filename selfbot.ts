import { AnyChannel, Client as DiscordClient, Message, TextChannel, DMChannel } from "discord.js-selfbot-v13";
import axios from "axios";

const discord_client = new DiscordClient();

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
        const originalChannel = await discord_client.channels.fetch(message.reference.channelId as string);
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
}

async function updateHistory(channel: AnyChannel, newMessageStruct: MessageStruct) {
    if (!(channel instanceof TextChannel) && !(channel instanceof DMChannel)) {
        console.error("Channel is not a TextChannel or DMChannel");
        return;
    }

    if (!message_history[channel.id]) {
        // Initialize by retrieving the last ten messages
        const messages = (await channel.messages.fetch({ limit: 10 })).reverse();
        const messageStructs = await Promise.all(messages.map((msg) => constructMessageStruct(msg)));
        message_history[channel.id] = messageStructs.filter((msg): msg is MessageStruct => msg !== null);
    } else {
        message_history[channel.id] = [...(message_history[channel.id] ?? []), newMessageStruct].slice(-50);
    }
}

async function generateResponse(id: string) {
    const channel_history: { role: "assistant" | "user"; message: string }[] = message_history[id].map(
        (entry) => ({
            role: entry.senderID == discord_client.user?.id ? "assistant" : "user",
            message: JSON.stringify(entry),
        })
    );

    const options = {
        method: "POST",
        url: "https://api.edenai.run/v2/text/chat",
        headers: {
            authorization: process.env.edenai,
        },
        data: {
            providers: "openai/gpt-4o",
            text: "continue chatting as normal",
            chatbot_global_action:
                `you are pal a random discord user just chatting about, reply to messages like you normally would.
                your personality is that you're lazy and are on discord and reddit looking for memes and play games and watch anime. you use a ton of slang and don't care much about others opinions
                the person who made you is HEXXT or @hexxt_
                your discord name is ${discord_client.user?.displayName} and your id is ${discord_client.user?.id}.
                you will receive messages in JSON containing sender information
                the message format you send out is just the text you want to say no extra punctuation and you can use discords markdown like features, it will later be processed into json
                the way you ping people is <@id>
                `.replace(/\s{2,}/g, ". "),
            previous_history: channel_history,
            temperature: 0.0,
            max_tokens: 150,
        },
    };

    const response = await axios.request(options).catch((error) => {
        console.error(error);
        console.log("there has been an error");
    });
    const data = response?.data["openai/gpt-4o"].generated_text;
    return data;
}

discord_client.on("ready", async () => {
    console.log(`${discord_client.user?.username} is ready!`);
});

discord_client.on("messageCreate", async (message) => {
    const messageStruct = await constructMessageStruct(message);
    if (messageStruct) {
        await updateHistory(message.channel, messageStruct);
    }
    if (message.author.id == discord_client.user?.id) return;
    const response: string | null = await generateResponse(message.channel.id);
    if (response) message.channel.send(response);
    // console.log(message_history);
});

discord_client.login(process.env.discordself);
