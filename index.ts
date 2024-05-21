const discordapi = process.env.discordapi;
const geminiapi = process.env.geminiapi;

console.log({discordapi, geminiapi})

import prettyjson from 'prettyjson';

import {
	GoogleGenerativeAI,
	HarmBlockThreshold,
	HarmCategory,
} from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(geminiapi||'');

async function send_message(channel) {
	let text = '';
	try {
		const model = genAI.getGenerativeModel({
			model: 'gemini-1.5-pro-latest',
			systemInstruction: `you are pal a random discord user just chatting about, reply to messages like you normally would.
                your personality is that youre lazy and are on discord and reddit looking for memes and play games and watch anime. you use a ton of slang and dont care much about others opinions
                you are actually a moderator on this server and ban people all the time using /ban <@id> 
                on the rare occasion remind people that they have to ping you for you to reply reliably (you can reply if not pinged but only to 10% of messages)
				the person who made you is HEXXT his handle is <@891724893547290725>.
				your wife is lina
				your discord handle is <@${client.user?.id}>. only english is allowed on the server
                the message format is just the text you want to say no extra punctuation and you can use discords markdown like features
				the way you ping people is by doing <@id>`.replace(/\s{2,}/g, '. ')
			,
		});

		const chat = model.startChat({
			history: message_history[channel.id] || [],
		});

		const result = await chat.sendMessage('system: reply');
		const response = result.response;
		text = response.text();
	} catch (error) {
		message_history[channel.id] = []
		console.error(error);
	}
	if (text != '') {
		message_history[channel.id] = message_history[channel.id] || []
		message_history[channel.id].push({
			role: 'model',
			parts: [{ text: text || 'ERROR' }],
		});
		let array = text.split('\n')
		for(let line of array){
			await new Promise(res => setTimeout(res, 200))
			try{
				if(line) channel.send(line);
			} catch (err) {
				console.error(err)
			}
		}
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

client.on('ready', () => {
	console.log(`Logged in as ${client.user!.tag}!`);
});

let message_history = {};

client.on('messageCreate', (message) => {
	console.log(`${message.author.displayName} (${message.author.id}): ${message.content}`)
	if (message.author.id == client.user!.id) return;
	if (message.content.match(/^\s*history\s*$/)) {
		console.log(prettyjson.render(message_history));
		return;
	}

	message_history[message.channel.id] =
		message_history[message.channel.id] || [];

	message_history[message.channel.id].push({
		role: 'user',
		parts: [{ text: `${message.author.displayName} (${message.author.id}): ${message.content}` }],
	});

	while (message_history[message.channel.id].length > 100)
		message_history[message.channel.id].shift();

	if (!message.mentions.users.some((user) => user.id == client.user!.id)) {
		if (Math.random() > 0.15) {
			return;
		}
	}

	send_message(message.channel);
});

client.login(discordapi);
