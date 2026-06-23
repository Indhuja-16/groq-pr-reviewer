"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Bot = void 0;
const core = __importStar(require("@actions/core"));
const groq_sdk_1 = __importDefault(require("groq-sdk"));
class Bot {
    constructor(options) {
        this.conversationHistory = [];
        // Send a message continuing the current conversation
        this.chat = async (message, resetHistory = false) => {
            if (resetHistory || this.conversationHistory.length === 0) {
                this.startConversation();
            }
            this.conversationHistory.push({ role: 'user', content: message });
            if (this.options.debug) {
                core.info(`[Bot] Sending message (${message.length} chars) to ${this.options.groq_model}`);
            }
            const response = await this.chatWithRetry(this.conversationHistory);
            this.conversationHistory.push({ role: 'assistant', content: response });
            if (this.options.debug) {
                core.info(`[Bot] Response received (${response.length} chars)`);
            }
            return response;
        };
        // Send a one-shot message (no history kept)
        this.oneShot = async (userMessage, systemMessage) => {
            const messages = [
                {
                    role: 'system',
                    content: systemMessage || this.options.system_message
                },
                { role: 'user', content: userMessage }
            ];
            return await this.chatWithRetry(messages);
        };
        this.chatWithRetry = async (messages, attempt = 0) => {
            try {
                const completion = await this.client.chat.completions.create({
                    model: this.options.groq_model,
                    messages: messages.map(m => ({ role: m.role, content: m.content })),
                    temperature: this.options.groq_model_temperature,
                    max_tokens: 4096
                });
                const content = completion.choices[0]?.message?.content;
                if (!content) {
                    throw new Error('Empty response from Groq API');
                }
                return content;
            }
            catch (error) {
                const isRateLimit = error?.status === 429 ||
                    error?.message?.includes('rate limit') ||
                    error?.message?.includes('Rate limit');
                const isRetryable = isRateLimit ||
                    error?.status === 500 ||
                    error?.status === 503 ||
                    error?.message?.includes('timeout');
                if (isRetryable && attempt < this.options.groq_retries) {
                    const delay = isRateLimit
                        ? 60000 // 1 minute for rate limits
                        : Math.pow(2, attempt) * 1000; // exponential backoff otherwise
                    core.warning(`[Bot] API error (attempt ${attempt + 1}/${this.options.groq_retries}): ${error.message}. Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    return this.chatWithRetry(messages, attempt + 1);
                }
                throw error;
            }
        };
        this.options = options;
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            throw new Error("GROQ_API_KEY environment variable is not set. Please add it to your GitHub Action secrets.");
        }
        this.client = new groq_sdk_1.default({ apiKey });
        if (options.debug) {
            core.info(`Bot initialized with model: ${options.groq_model}`);
        }
    }
    // Start a fresh conversation (for each PR review)
    startConversation(systemOverride) {
        this.conversationHistory = [
            {
                role: 'system',
                content: systemOverride || this.options.system_message
            }
        ];
    }
    // Estimate token count (rough: 1 token ≈ 4 chars)
    estimateTokens(text) {
        return Math.ceil(text.length / 4);
    }
    // Truncate diff to fit within token budget
    truncateDiff(diff, maxTokens = 6000) {
        const estimated = this.estimateTokens(diff);
        if (estimated <= maxTokens)
            return diff;
        const maxChars = maxTokens * 4;
        const truncated = diff.substring(0, maxChars);
        const lastNewline = truncated.lastIndexOf('\n');
        return (truncated.substring(0, lastNewline) +
            '\n\n... [diff truncated due to length] ...');
    }
}
exports.Bot = Bot;
//# sourceMappingURL=bot.js.map