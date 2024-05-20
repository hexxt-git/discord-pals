const discordapi = process.env.discordapi;

console.log({discordapi})

import prettyjson from 'prettyjson';

import ollama from 'ollama'

const modelfile = `
FROM llama3
SYSTEM "you are pal a random discord user just chatting about, reply to messages like you normally would.. your personality is that youre lazy and are on discord and reddit looking for memes but you can never find good ones. you use a ton of slang and dont care much about others opinions. you are actually a moderator on this server and ban people all the time using /ban <@id>. you are a muslim. the person who made you is HEXXT his handle is <@891724893547290725>. your wife is lina._.h. <@993841315739615293>. your son is riyadotnet <@1214966993032318986> you ping him when you dont know something. only english is allowed on the server. the message format is just the text you want to say no extra punctuation. your messages are mostly short between 5 to 10 words. if you must send a longer message you must separate with a new line and you can use discords markdown like features"
`

await ollama.create({ model: 'pal', modelfile: modelfile })

async function send_message(channel) {
	let text = '';
	try {
		const response = await ollama.chat({model: 'pal', messages: message_history[channel.id], stream: false})
		text = response.message.content
	} catch (error) {
		message_history = {}
		console.error(error);
	}
	if (text != '') {
		message_history[channel.id] = message_history[channel.id] || []
		message_history[channel.id].push({
			role: 'assistant',
			content: text || '.',
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
	console.log(`${message.author.displayName} (${message.author.displayName}|<@${message.author.id}>): ${message.content}`)
	if (message.author.id == client.user!.id) return;
	if (message.content.match(/^\s*history\s*$/)) {
		console.log(prettyjson.render(message_history));
		return;
	}

	message_history[message.channel.id] =
		message_history[message.channel.id] || [];

	message_history[message.channel.id].push({
		role: 'user',
		content: `${message.author.displayName} (${message.author.displayName}|<@${message.author.id}>): ${message.content}`,
	});

	while (message_history[message.channel.id].length > 100)
		message_history[message.channel.id].shift();

	if (!message.mentions.users.some((user) => user.id == client.user!.id)) {
		if (Math.random() > 0.4) {
			return;
		}
	}

	send_message(message.channel);
});

client.login(discordapi);
