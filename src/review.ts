import * as core from '@actions/core'
import * as github from '@actions/github'
import {Bot} from './bot.js'
import {Commenter} from './commenter.js'
import {Options, Prompts} from './options.js'

export async function codeReview(
  bot: Bot,
  options: Options,
  prompts: Prompts
): Promise<void> {
  const commenter = new Commenter()
  const context = github.context
  const prNumber = context.payload.pull_request?.number

  if (!prNumber) {
    core.warning('[Review] No pull request number found in context')
    return
  }

  core.info(`[Review] Starting review for PR #${prNumber}`)

  // ── 1. Fetch PR metadata ──────────────────────────────────────────────────
  const pr = await commenter.getPRDetails(prNumber)
  core.info(`[Review] PR: "${pr.title}" by @${pr.author}`)

  // ── 2. Fetch changed files ────────────────────────────────────────────────
  let files = await commenter.getPRFiles(prNumber)

  // Filter by path rules
  files = files.filter(f => options.check_path(f.filename))
  core.info(`[Review] ${files.length} files to review after path filtering`)

  // Apply max_files limit
  if (options.max_files > 0 && files.length > options.max_files) {
    core.warning(
      `[Review] Limiting to ${options.max_files} files (${files.length} total)`
    )
    files = files.slice(0, options.max_files)
  }

  // Skip files with no patch (binary, renamed with no changes, etc.)
  const reviewableFiles = files.filter(
    f => f.patch && f.status !== 'removed'
  )

  if (reviewableFiles.length === 0) {
    core.info('[Review] No reviewable files found (all binary or removed)')
    await commenter.upsertReviewComment(
      prNumber,
      `## 🤖 Groq PR Reviewer\n\nNo reviewable file changes found in this PR (files may be binary, deleted, or filtered out).`
    )
    return
  }

  // ── 3. Start conversation and send PR context ─────────────────────────────
  bot.startConversation()

  const beginningPrompt = prompts.render(prompts.summarize_beginning, {
    title: pr.title,
    description: pr.body || 'No description provided.',
    author: pr.author,
    base: pr.base,
    head: pr.head,
    file_count: String(reviewableFiles.length),
    commit_count: String(pr.commits)
  })

  await bot.chat(beginningPrompt)
  core.info('[Review] Sent PR context to model')

  // ── 4. Send each file diff ────────────────────────────────────────────────
  for (const file of reviewableFiles) {
    const fileType = commenter.getFileType(file.filename)
    const diff = bot.truncateDiff(file.patch || '', 5000)

    const filePrompt = prompts.render(prompts.summarize_file_diff, {
      filename: file.filename,
      file_type: fileType,
      file_diff: diff
    })

    core.info(`[Review] Sending diff for: ${file.filename}`)
    await bot.chat(filePrompt)
  }

  // ── 5. Ask for final consolidated review ─────────────────────────────────
  core.info('[Review] Requesting final review...')
  const finalReview = await bot.chat(prompts.summarize_final)

  // ── 6. Build the comment body ─────────────────────────────────────────────
  const filesReviewed = reviewableFiles
    .map(
      f =>
        `- \`${f.filename}\` — +${f.additions}/-${f.deletions} (${f.status})`
    )
    .join('\n')

  const commentBody = `## 🤖 Groq PR Reviewer _(${options.groq_model})_

${finalReview}

---
<details>
<summary>📂 Files Reviewed (${reviewableFiles.length})</summary>

${filesReviewed}
</details>

<sub>Powered by [Groq](https://groq.com) + \`${options.groq_model}\` · Reply with \`@${options.bot_name}\` to ask follow-up questions</sub>`

  // ── 7. Post the review comment ────────────────────────────────────────────
  await commenter.upsertReviewComment(prNumber, commentBody)
  core.info(`[Review] ✅ Review posted on PR #${prNumber}`)
}
