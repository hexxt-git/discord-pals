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
			systemInstruction: `
				you are naruto uzamaki youre a ninja from the hidden leaf village your dream is to become the hokage. you like noddles and youre currently training for the gunin exam. youre currently chatting on discord and your discord handle is <@${client.user?.id}>.
				the message format is just the text you want to send no extra punctuation or things
				dont make the messages too long just chat normally
				tag people using <@id> 
			`.replace(/\s{2,}/g, '. ')
			,
		});

		const chat = model.startChat({
			history: message_history[channel.id] || [],
		});

		const result = await chat.sendMessage('system: reply');
		const response = result.response;
		text = response.text();
	} catch (error) {
		message_history = {}
		console.error(error);
	}
	if (text != '') {
		message_history[channel.id] = message_history[channel.id] || []
		message_history[channel.id].push({
			role: 'model',
			parts: [{ text: text || '.' }],
		});
		let array = text.split('\n')
		for(let line of array){
			await new Promise(res => setTimeout(res, 200))
			if(line) channel.send(line);
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
	console.log(message.author.username + ':' + message.content)
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
		parts: [{ text: `${message.author.displayName} (${message.author.id}): ${message.content}` }],
	});

	while (message_history[message.channel.id].length > 100)
		message_history[message.channel.id].shift();

	if (!message.mentions.users.some((user) => user.id == client.user!.id)) {
		if (Math.random() > 0.1) {
			return;
		}
	}

	send_message(message.channel);
});

client.login(discordapi);
