import { Options } from './options.js';
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
}
export declare class Bot {
    private client;
    private options;
    private conversationHistory;
    constructor(options: Options);
    startConversation(systemOverride?: string): void;
    chat: (message: string, resetHistory?: boolean) => Promise<string>;
    oneShot: (userMessage: string, systemMessage?: string) => Promise<string>;
    private chatWithRetry;
    estimateTokens(text: string): number;
    truncateDiff(diff: string, maxTokens?: number): string;
}
//# sourceMappingURL=bot.d.ts.map