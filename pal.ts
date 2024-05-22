import { GenerativeModel, GoogleGenerativeAI } from '@google/generative-ai';
const genAi = new GoogleGenerativeAI(process.env.geminikey || '');

export interface Message {
	role: string;
	parts: Array<{ text: string }>;
}

export class Pal {
	name: string;
	instruction: string;
	model: GenerativeModel;
	constructor(name: string, description: string) {
		this.name = name;
		this.instruction = description;
		this.model = genAi.getGenerativeModel({
			model: 'gemini-1.5-pro-latest',
			systemInstruction: this.generateSystemInstructions(),
		});
	}
	generateSystemInstructions() {
		return `
            your name is ${this.name}
            ${this.instruction}
            you're on discord. to chat just send the message with no extra punctuation
        `.replace(/\s+/g, ' ');
	}
	async generateResponse(history: Array<Message>) {
        try{
            const chat = this.model.startChat({
                history: history || [],
            });
            const result = await chat.sendMessage('system: reply');
            const response = result.response;
            const text = response.text();

            return text;
        } catch (e) {
            return 'I am sorry, I am not able to respond to that.'
        }
	}
}
