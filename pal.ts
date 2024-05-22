// all the gemini stuff
import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
const genAi = new GoogleGenerativeAI(process.env.geminikey || '');

export const sleep = async (time: number) =>
	new Promise((res) => setTimeout(res, time));

export interface Message {
	role: string;
	parts: Array<{ text: string }>;
}

export class Pal {
	name: string;
	photo: string;
	instruction: string;
	model: GenerativeModel;
	constructor(name: string, photo: string, description: string) {
		this.name = name;
		this.instruction = description;
		this.photo = photo;
		this.model = genAi.getGenerativeModel({
			model: 'gemini-1.5-pro-latest',
			systemInstruction: this.generateSystemInstructions(),
		});
	}
	generateSystemInstructions() {
		return `
            your name is ${this.name}
            ${this.instruction}
            you're on discord. to chat just send the message with no extra punctuation and formatting.
        `.replace(/\s+/g, ' ');
	}
	async generateResponse(history: Array<Message>, attempts: number = 0) {
		if (attempts > 3) return '';
		try {
			const chat = this.model.startChat({
				history: history || [],
			});
			const result = await chat.sendMessage('system: reply');
			const response = result.response;
			const text = response.text();

			return text;
		} catch (e) {
			console.error(e)
			await sleep(1000);
			return await this.generateResponse(history, attempts + 1);
		}
	}
}
