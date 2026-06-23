import * as core from '@actions/core'
import * as github from '@actions/github'

export class Commenter {
  private octokit: ReturnType<typeof github.getOctokit>
  private owner: string
  private repo: string

  // Tag embedded in comments so we can find and update them
  private readonly REVIEW_TAG = '<!-- groq-pr-reviewer:review -->'
  private readonly SUMMARY_TAG = '<!-- groq-pr-reviewer:summary -->'

  constructor() {
    const token = process.env.GITHUB_TOKEN
    if (!token) {
      throw new Error('GITHUB_TOKEN is not set')
    }
    this.octokit = github.getOctokit(token)
    this.owner = github.context.repo.owner
    this.repo = github.context.repo.repo
  }

  // Post or update the main PR review comment
  async upsertReviewComment(
    prNumber: number,
    body: string
  ): Promise<void> {
    const taggedBody = `${this.REVIEW_TAG}\n${body}`
    const existing = await this.findComment(prNumber, this.REVIEW_TAG)

    if (existing) {
      core.info(`[Commenter] Updating existing review comment #${existing.id}`)
      await this.octokit.rest.issues.updateComment({
        owner: this.owner,
        repo: this.repo,
        comment_id: existing.id,
        body: taggedBody
      })
    } else {
      core.info(`[Commenter] Creating new review comment on PR #${prNumber}`)
      await this.octokit.rest.issues.createComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: prNumber,
        body: taggedBody
      })
    }
  }

  // Reply to a specific review comment thread
  async replyToComment(
    prNumber: number,
    commentId: number,
    body: string
  ): Promise<void> {
    // Try as a PR review comment first, then as issue comment
    try {
      await this.octokit.rest.pulls.createReplyForReviewComment({
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        comment_id: commentId,
        body
      })
      core.info(`[Commenter] Replied to review comment #${commentId}`)
    } catch {
      // Fallback: post as a regular issue comment
      await this.octokit.rest.issues.createComment({
        owner: this.owner,
        repo: this.repo,
        issue_number: prNumber,
        body
      })
      core.info(`[Commenter] Posted reply as issue comment (fallback)`)
    }
  }

  // Get the PR diff
  async getPRDiff(prNumber: number): Promise<string> {
    const {data} = await this.octokit.rest.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber,
      mediaType: {format: 'diff'}
    })
    return data as unknown as string
  }

  // Get list of files changed in the PR
  async getPRFiles(
    prNumber: number
  ): Promise<
    Array<{
      filename: string
      status: string
      additions: number
      deletions: number
      patch?: string
    }>
  > {
    const files = await this.octokit.paginate(
      this.octokit.rest.pulls.listFiles,
      {
        owner: this.owner,
        repo: this.repo,
        pull_number: prNumber,
        per_page: 100
      }
    )
    return files
  }

  // Get PR metadata
  async getPRDetails(prNumber: number): Promise<{
    title: string
    body: string
    author: string
    base: string
    head: string
    commits: number
  }> {
    const {data} = await this.octokit.rest.pulls.get({
      owner: this.owner,
      repo: this.repo,
      pull_number: prNumber
    })

    return {
      title: data.title,
      body: data.body || '',
      author: data.user?.login || 'unknown',
      base: data.base.ref,
      head: data.head.ref,
      commits: data.commits
    }
  }

  // Get the comment that triggered the action
  async getComment(commentId: number): Promise<{
    body: string
    user: string
  } | null> {
    try {
      // Try as PR review comment
      const {data} = await this.octokit.rest.pulls.getReviewComment({
        owner: this.owner,
        repo: this.repo,
        comment_id: commentId
      })
      return {body: data.body, user: data.user?.login || 'unknown'}
    } catch {
      try {
        // Fallback: issue comment
        const {data} = await this.octokit.rest.issues.getComment({
          owner: this.owner,
          repo: this.repo,
          comment_id: commentId
        })
        return {body: data.body || '', user: data.user?.login || 'unknown'}
      } catch {
        return null
      }
    }
  }

  // Get PR review comment context (file + diff) for a given comment ID
  async getReviewCommentContext(commentId: number): Promise<{
    filename: string
    diff_hunk: string
    body: string
  } | null> {
    try {
      const {data} = await this.octokit.rest.pulls.getReviewComment({
        owner: this.owner,
        repo: this.repo,
        comment_id: commentId
      })
      return {
        filename: data.path,
        diff_hunk: data.diff_hunk,
        body: data.body
      }
    } catch {
      return null
    }
  }

  // Find an existing comment by its tag
  private async findComment(
    prNumber: number,
    tag: string
  ): Promise<{id: number} | null> {
    const comments = await this.octokit.paginate(
      this.octokit.rest.issues.listComments,
      {
        owner: this.owner,
        repo: this.repo,
        issue_number: prNumber,
        per_page: 100
      }
    )

    for (const comment of comments) {
      if (comment.body?.includes(tag)) {
        return {id: comment.id}
      }
    }
    return null
  }

  // Detect file type from filename for better prompting
  getFileType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase() || ''
    const typeMap: Record<string, string> = {
      ts: 'TypeScript',
      tsx: 'TypeScript/React',
      js: 'JavaScript',
      jsx: 'JavaScript/React',
      py: 'Python',
      go: 'Go',
      rs: 'Rust',
      java: 'Java',
      kt: 'Kotlin',
      swift: 'Swift',
      cs: 'C#',
      cpp: 'C++',
      c: 'C',
      rb: 'Ruby',
      php: 'PHP',
      sql: 'SQL',
      yml: 'YAML',
      yaml: 'YAML',
      json: 'JSON',
      md: 'Markdown',
      sh: 'Shell',
      dockerfile: 'Dockerfile',
      tf: 'Terraform',
      toml: 'TOML'
    }
    return typeMap[ext] || ext.toUpperCase() || 'Unknown'
  }
}
