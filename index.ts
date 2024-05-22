// all the discord stuff
const discordkey = process.env.discordkey;

import { Client, GatewayIntentBits, WebhookClient } from 'discord.js';
import { Message, Pal, sleep } from './pal';

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildWebhooks,
	],
});

client.on('ready', () => {
	console.log(`Logged in as ${client.user!.tag}!`);
});

const message_history = {};
const pals: Array<Pal> = [
	new Pal(
		'pal',
		'https://media.discordapp.net/attachments/1242889619922616462/1242964985466851338/Screenshot_from_2024-05-20_07-53-47.png?ex=664fc0d9&is=664e6f59&hm=945492b025671419a3d1a59140dce9d7d31a11ae8034f2da988505356a6e7997&=&format=webp&quality=lossless&width=373&height=356',
		'you are a normal discord user, you like memes and games'
	),
];

client.on('messageCreate', async (message) => {
	if (message.content[0] == '?') {
		return;
	}
	const message_content: Message = {
		role: 'user',
		parts: [
			{
				text: `${message.author.displayName} (${message.author.id}): ${message.content}`,
			},
		],
	};
	if (message.reference && message.reference.messageId) {
		const originalChannel = await client.channels.fetch(
			message.reference.channelId
		);
		if (originalChannel?.isTextBased()) {
			const originalMessage = await originalChannel.messages.fetch(
				message.reference.messageId as string
			);
			message_content.parts[0].text += `. \n replying to ${originalMessage.author.displayName} (${originalMessage.author.id}): ${originalMessage.content}`;
		}
	}
	//console.log(message_content)

	message_history[message.channel.id] =
		message_history[message.channel.id] || [];
	message_history[message.channel.id].push(message_content);

	if (message.author.bot) return;
	pals.forEach(async (pal) => {
		const response = await pal.generateResponse(
			message_history[message.channel.id]
		); //.split('\n')
		if (!response) return;
		const webhook = await message.channel.createWebhook({
			name: pal.name,
			avatar: pal.photo,
			reason: 'needed a webhook',
		});

		await webhook.send({
			content: response || 'ERROR',
			username: pal.name,
			avatarURL: pal.photo,
		});

		// 	if(response[0]) message.reply(response[0])
		// 	for(let part of response.slice(1)){
		// 		await sleep(200+Math.random()*500);
		// 		if(!part) continue
		// 		message.channel.send(part)
		// 	}
		// });
	});
});

await client.login(discordkey);
if (!client.user) process.exit(-1);
