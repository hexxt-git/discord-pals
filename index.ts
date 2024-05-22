const discordkey = process.env.discordkey;
const geminikey = process.env.geminikey;

console.log({ discordkey, geminikey });

import { Client, GatewayIntentBits } from 'discord.js';
import { Message, Pal } from './pal';

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
	],
});

client.on('ready', () => {
	console.log(`Logged in as ${client.user!.tag}!`);
});

const message_history = {};
const pals: Array<Pal> = [new Pal('pal', 'you are a friendly chatbot')];

client.on('messageCreate', async (message) => {
	const message_content: Message = {
		role: 'user',
		parts: [{text: `${message.author.displayName} (${message.author.id}): ${message.content}`}],
	};
	if(message.reference){
		const originalChannel = await client.channels.fetch(message.reference.channelId)
		if(originalChannel?.isTextBased()){
			const originalMessage = await originalChannel.messages.fetch(message.reference.messageId)
			message_content.parts[0].text += `. \n replying to ${originalMessage.author.displayName} (${originalMessage.author.id}): ${originalMessage.content}`
		}
	}
	console.log(message_content)

	message_history[message.channel.id] =
		message_history[message.channel.id] || [];
	message_history[message.channel.id].push(message_content);

	if(message.author.bot) return;
	pals.forEach(async (pal) => {
		const response = await pal.generateResponse(
			message_history[message.channel.id]
		);
		message.reply(response);
	});
});

await client.login(discordkey);
if (!client.user) process.exit(-1);
