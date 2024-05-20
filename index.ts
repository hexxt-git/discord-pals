const discordapi = process.env.discordapi;
const geminiapi = process.env.geminiapi;

console.log({discordapi, geminiapi})

import prettyjson from 'prettyjson';

import {
	GoogleGenerativeAI,
	HarmBlockThreshold,
	HarmCategory,
} from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(geminiapi);

async function send_message(channel) {
	lastMessageTime = new Date().getTime();
	let text = '';
	try {
		const model = genAI.getGenerativeModel({
			model: 'gemini-1.5-pro-latest',
			systemInstruction: `you are pal a random discord user just chatting about, reply to messages like you normally would.
                your personality is that youre lazy and are on discord and reddit browsing memes all day. you use a ton of slang and dont care much about others opinions
                you are actually a moderator on this server and threaten to ban people all the time
                on the rare occasion remind people that they have to ping you for you to reply reliably
				the person who made you is HEXXT his handle is <@891724893547290725> 
                your discord handle is <@${client.user?.id}>.
                the message format is just the text you want to say no extra punctuation`,
			safetySettings: [
				{
					category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
					threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH,
				},
				{
					category: HarmCategory.HARM_CATEGORY_HARASSMENT,
					threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
				},
				{
					category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
					threshold: HarmBlockThreshold.BLOCK_LOW_AND_ABOVE,
				},
				{
					category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
					threshold: HarmBlockThreshold.BLOCK_NONE,
				},
			],
		});

		const chat = model.startChat({
			history: message_history[channel.id] || [],
			generationConfig: {
				//maxOutputTokens: 200,
			},
		});

		const result = await chat.sendMessage('system: reply');
		const response = result.response;
		text = response.text();
	} catch (error) {
		console.error(error);
	}
	if (text != '') {
		message_history[channel.id].push({
			role: 'model',
			parts: [{ text }],
		});
		channel.send(text);
	}
}

import Discord from 'discord.js';
const client = new Discord.Client({
	intents: [
		Discord.GatewayIntentBits.Guilds,
		Discord.GatewayIntentBits.GuildMessages,
		Discord.GatewayIntentBits.MessageContent,
	],
});

const token = discordapi;

client.on('ready', () => {
	console.log(`Logged in as ${client.user!.tag}!`);
});

const message_history = {};
const timeThreshold = 3 * 1000;
let lastMessageTime = 0;

client.on('messageCreate', (message) => {
	if (message.author.id == client.user!.id) return;
	if (message.content.match(/^\s*history\s*$/)) {
		console.log(prettyjson.render(message_history));
		message.channel.send(
			prettyjson.render(message_history, { noColor: true })
		);
		return;
	}

	message_history[message.channel.id] =
		message_history[message.channel.id] || [];

	message_history[message.channel.id].push({
		role: 'user',
		parts: [{ text: `${message.author.displayName}: ${message.content}` }],
	});

	while (message_history[message.channel.id].length > 100)
		message_history[message.channel.id].shift();

	if (!message.mentions.users.some((user) => user.id == client.user!.id)) {
		if (new Date().getTime() - lastMessageTime < timeThreshold) {
			console.log(
				new Date().getTime() - lastMessageTime
			);
			return;
		}
		if (Math.random() > 0.3) {
			return;
		}
	}

	send_message(message.channel);
});

client.login(token);
