import * as core from '@actions/core'
import * as github from '@actions/github'
import {Bot} from './bot.js'
import {Options, Prompts} from './options.js'
import {codeReview} from './review.js'
import {handleReviewComment} from './review-comment.js'

async function run(): Promise<void> {
  // ── Load options from action inputs ───────────────────────────────────────
  const options = new Options(
    core.getBooleanInput('debug'),
    core.getInput('max_files'),
    core.getBooleanInput('review_comment_lgtm'),
    core.getMultilineInput('path_filters'),
    core.getInput('system_message'),
    core.getInput('groq_model'),
    core.getInput('groq_model_temperature'),
    core.getInput('groq_retries'),
    core.getInput('groq_timeout_ms'),
    core.getInput('groq_concurrency_limit'),
    core.getInput('bot_name')
  )

  if (options.debug) {
    options.print()
    core.info(`[Main] GitHub event: ${process.env.GITHUB_EVENT_NAME}`)
    core.info(`[Main] Repository: ${github.context.repo.owner}/${github.context.repo.repo}`)
  }

  // ── Load prompt templates ─────────────────────────────────────────────────
  const prompts = new Prompts(
    core.getInput('summarize_beginning'),
    core.getInput('summarize_file_diff'),
    core.getInput('summarize_final'),
    core.getInput('summarize_release_notes'),
    core.getInput('comment_reply')
  )

  // ── Initialize Groq bot ───────────────────────────────────────────────────
  let bot: Bot
  try {
    bot = new Bot(options)
  } catch (e: any) {
    core.setFailed(
      `Failed to initialize Groq bot: ${e.message}\n\nMake sure GROQ_API_KEY is set in your repository secrets.`
    )
    return
  }

  // ── Route to the right handler based on GitHub event ─────────────────────
  const eventName = process.env.GITHUB_EVENT_NAME

  try {
    if (eventName === 'pull_request' || eventName === 'pull_request_target') {
      core.info('[Main] Handling pull request event → running code review')
      await codeReview(bot, options, prompts)
    } else if (
      eventName === 'pull_request_review_comment' ||
      eventName === 'issue_comment'
    ) {
      core.info('[Main] Handling comment event → checking for bot mention')
      await handleReviewComment(bot, options, prompts)
    } else {
      core.warning(
        `[Main] Unsupported event: ${eventName}. This action handles: pull_request, pull_request_target, pull_request_review_comment, issue_comment`
      )
    }
  } catch (e: any) {
    if (e instanceof Error) {
      core.setFailed(`[Main] Action failed: ${e.message}\n${e.stack}`)
    } else {
      core.setFailed(`[Main] Action failed: ${String(e)}`)
    }
  }
}

// Handle uncaught errors gracefully
process.on('unhandledRejection', (reason, promise) => {
  core.warning(`Unhandled Promise Rejection: ${reason}`)
})

process.on('uncaughtException', (error) => {
  core.warning(`Uncaught Exception: ${error.message}`)
})

// Run
run()
