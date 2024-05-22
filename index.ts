const discordkey = process.env.discordkey;
const geminikey = process.env.geminikey;

console.log({ discordkey, geminikey });

import { Client, GatewayIntentBits, SlashCommandBuilder } from 'discord.js';
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

client.on('messageCreate', (message) => {
	console.log(message.content);
});

await client.login(discordkey);
if (!client.user) process.exit(-1);
