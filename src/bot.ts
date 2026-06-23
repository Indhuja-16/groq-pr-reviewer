import * as core from '@actions/core'
import Groq from 'groq-sdk'
import {Options} from './options.js'

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

export class Bot {
  private client: Groq
  private options: Options
  private conversationHistory: ChatMessage[] = []

  constructor(options: Options) {
    this.options = options

    const apiKey = process.env.GROQ_API_KEY
    if (!apiKey) {
      throw new Error(
        "GROQ_API_KEY environment variable is not set. Please add it to your GitHub Action secrets."
      )
    }

    this.client = new Groq({apiKey})

    if (options.debug) {
      core.info(`Bot initialized with model: ${options.groq_model}`)
    }
  }

  // Start a fresh conversation (for each PR review)
  startConversation(systemOverride?: string): void {
    this.conversationHistory = [
      {
        role: 'system',
        content: systemOverride || this.options.system_message
      }
    ]
  }

  // Send a message continuing the current conversation
  chat = async (
    message: string,
    resetHistory = false
  ): Promise<string> => {
    if (resetHistory || this.conversationHistory.length === 0) {
      this.startConversation()
    }

    this.conversationHistory.push({role: 'user', content: message})

    if (this.options.debug) {
      core.info(`[Bot] Sending message (${message.length} chars) to ${this.options.groq_model}`)
    }

    const response = await this.chatWithRetry(this.conversationHistory)

    this.conversationHistory.push({role: 'assistant', content: response})

    if (this.options.debug) {
      core.info(`[Bot] Response received (${response.length} chars)`)
    }

    return response
  }

  // Send a one-shot message (no history kept)
  oneShot = async (
    userMessage: string,
    systemMessage?: string
  ): Promise<string> => {
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: systemMessage || this.options.system_message
      },
      {role: 'user', content: userMessage}
    ]

    return await this.chatWithRetry(messages)
  }

  private chatWithRetry = async (
    messages: ChatMessage[],
    attempt = 0
  ): Promise<string> => {
    try {
      const completion = await this.client.chat.completions.create({
        model: this.options.groq_model,
        messages: messages.map(m => ({role: m.role, content: m.content})),
        temperature: this.options.groq_model_temperature,
        max_tokens: 4096
      })

      const content = completion.choices[0]?.message?.content
      if (!content) {
        throw new Error('Empty response from Groq API')
      }

      return content
    } catch (error: any) {
      const isRateLimit =
        error?.status === 429 ||
        error?.message?.includes('rate limit') ||
        error?.message?.includes('Rate limit')

      const isRetryable =
        isRateLimit ||
        error?.status === 500 ||
        error?.status === 503 ||
        error?.message?.includes('timeout')

      if (isRetryable && attempt < this.options.groq_retries) {
        const delay = isRateLimit
          ? 60000 // 1 minute for rate limits
          : Math.pow(2, attempt) * 1000 // exponential backoff otherwise

        core.warning(
          `[Bot] API error (attempt ${attempt + 1}/${this.options.groq_retries}): ${error.message}. Retrying in ${delay}ms...`
        )

        await new Promise(resolve => setTimeout(resolve, delay))
        return this.chatWithRetry(messages, attempt + 1)
      }

      throw error
    }
  }

  // Estimate token count (rough: 1 token ≈ 4 chars)
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4)
  }

  // Truncate diff to fit within token budget
  truncateDiff(diff: string, maxTokens = 6000): string {
    const estimated = this.estimateTokens(diff)
    if (estimated <= maxTokens) return diff

    const maxChars = maxTokens * 4
    const truncated = diff.substring(0, maxChars)
    const lastNewline = truncated.lastIndexOf('\n')
    return (
      truncated.substring(0, lastNewline) +
      '\n\n... [diff truncated due to length] ...'
    )
  }
}
