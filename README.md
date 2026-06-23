# 🤖 Groq PR Reviewer

> AI-powered GitHub PR reviewer using **Groq** + **`openai/gpt-oss-120b`** — fast, free, and smart.

## What it does

- **📋 PR Summary** — Plain-English explanation of what the PR does
- **📝 What Changed** — Per-file breakdown of code changes
- **🐛 Bug & Error Detection** — Finds issues and provides corrected code snippets
- **⚠️ Code Quality Warnings** — Spots smells, anti-patterns, and minor issues
- **🔒 Security Notes** — Flags potential security concerns
- **🚀 Release Notes** — Auto-generated CHANGELOG entry
- **💬 @mention Replies** — Tag `@groq-reviewer` in any review comment for follow-up answers

## Setup

### 1. Get a free Groq API key
Go to [console.groq.com](https://console.groq.com) → create an account → generate an API key (free tier available).

### 2. Add the secret to your repo
`Settings → Secrets → Actions → New repository secret`....

| Secret name | Value |
|---|---|
| `GROQ_API_KEY` | Your Groq API key |

### 3. Add the workflow file
Create `.github/workflows/pr-review.yml` in your repository:

```yaml
name: Groq PR Review

permissions:
  contents: read
  pull-requests: write
  issues: write

on:
  pull_request:
    types: [opened, synchronize, reopened]
  pull_request_review_comment:
    types: [created]
  issue_comment:
    types: [created]

concurrency:
  group: >-
    ${{ github.repository }}-${{ github.event.number || github.head_ref || github.sha }}-${{
    github.workflow }}-${{ (github.event_name == 'pull_request_review_comment' ||
    github.event_name == 'issue_comment') && 'comment' || 'pr' }}
  cancel-in-progress: >-
    ${{ github.event_name != 'pull_request_review_comment' &&
        github.event_name != 'issue_comment' }}

jobs:
  review:
    if: >-
      github.event_name == 'pull_request' ||
      github.event_name == 'pull_request_review_comment' ||
      (github.event_name == 'issue_comment' && github.event.issue.pull_request)
    runs-on: ubuntu-latest
    steps:
      - uses: your-org/groq-pr-reviewer@main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GROQ_API_KEY: ${{ secrets.GROQ_API_KEY }}
        with:
          debug: false
          bot_name: groq-reviewer
```

## Configuration

| Input | Default | Description |
|---|---|---|
| `bot_name` | `groq-reviewer` | Name used for `@mention` replies |
| `groq_model` | `openai/gpt-oss-120b` | Groq model to use |
| `groq_model_temperature` | `0.3` | Lower = more deterministic |
| `max_files` | `0` (no limit) | Limit number of files reviewed |
| `review_comment_lgtm` | `false` | Comment even when code is fine |
| `path_filters` | (see action.yml) | Glob patterns to include/exclude files |
| `debug` | `false` | Log API messages to CI |

### Path filters example
```yaml
path_filters: |
  src/**/*.ts
  src/**/*.py
  !**/*.test.ts
  !dist/**
```

## Conversation support

Reply to any review comment and mention `@groq-reviewer`:

> `@groq-reviewer Can you explain why this approach might cause a memory leak?`

The bot will reply with context-aware explanation using the file diff as reference.

## Building from source

```bash
npm install
npm run build      # TypeScript → dist/
npm run package    # bundle → dist/bundle/index.js
```

## License
MIT
