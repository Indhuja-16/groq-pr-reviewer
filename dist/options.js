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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Prompts = exports.PathFilter = exports.Options = void 0;
const core = __importStar(require("@actions/core"));
const minimatch_1 = require("minimatch");
class Options {
    constructor(debug, max_files = '0', review_comment_lgtm = false, path_filters = [], system_message = '', groq_model = 'openai/gpt-oss-120b', groq_model_temperature = '0.3', groq_retries = '3', groq_timeout_ms = '120000', groq_concurrency_limit = '4', bot_name = 'groq-reviewer') {
        this.debug = debug;
        this.max_files = parseInt(max_files) || 0;
        this.review_comment_lgtm = review_comment_lgtm;
        this.path_filters = new PathFilter(path_filters);
        this.system_message =
            system_message ||
                `You are an expert software engineer and code reviewer. Your job is to:
1. Review pull request code changes thoroughly.
2. Identify bugs, logic errors, security issues, and code quality problems.
3. Suggest clear, actionable fixes with corrected code snippets.
4. Explain what changed and why it matters in plain language.
5. Be constructive, concise, and developer-friendly.

Always format your review using markdown. Use code blocks for code examples.`;
        this.groq_model = groq_model || 'openai/gpt-oss-120b';
        this.groq_model_temperature = parseFloat(groq_model_temperature) || 0.3;
        this.groq_retries = parseInt(groq_retries) || 3;
        this.groq_timeout_ms = parseInt(groq_timeout_ms) || 120000;
        this.groq_concurrency_limit = parseInt(groq_concurrency_limit) || 4;
        this.bot_name = bot_name || 'groq-reviewer';
    }
    print() {
        core.info(`Options:
  debug: ${this.debug}
  max_files: ${this.max_files}
  review_comment_lgtm: ${this.review_comment_lgtm}
  groq_model: ${this.groq_model}
  groq_model_temperature: ${this.groq_model_temperature}
  groq_retries: ${this.groq_retries}
  groq_timeout_ms: ${this.groq_timeout_ms}
  groq_concurrency_limit: ${this.groq_concurrency_limit}
  bot_name: ${this.bot_name}`);
    }
    check_path(path) {
        const ok = this.path_filters.check(path);
        if (this.debug) {
            core.info(`checking path: ${path} => ${ok}`);
        }
        return ok;
    }
}
exports.Options = Options;
class PathFilter {
    constructor(rules = []) {
        this.rules = [];
        for (const rule of rules) {
            const trimmed = rule.trim();
            if (trimmed) {
                if (trimmed.startsWith('!')) {
                    this.rules.push([trimmed.substring(1).trim(), true]);
                }
                else {
                    this.rules.push([trimmed, false]);
                }
            }
        }
    }
    check(path) {
        if (this.rules.length === 0) {
            return true;
        }
        let included = false;
        let excluded = false;
        let inclusionRuleExists = false;
        for (const [rule, exclude] of this.rules) {
            if ((0, minimatch_1.minimatch)(path, rule)) {
                if (exclude) {
                    excluded = true;
                }
                else {
                    included = true;
                }
            }
            if (!exclude) {
                inclusionRuleExists = true;
            }
        }
        return (!inclusionRuleExists || included) && !excluded;
    }
}
exports.PathFilter = PathFilter;
class Prompts {
    constructor(summarize_beginning = '', summarize_file_diff = '', summarize_final = '', summarize_release_notes = '', comment_reply = '') {
        this.summarize_beginning =
            summarize_beginning ||
                `You are reviewing a pull request titled: "$title"

**PR Description:**
$description

**Author:** $author
**Base branch:** $base → **Head branch:** $head
**Files changed:** $file_count | **Commits:** $commit_count

Your task is to build a thorough understanding of this PR. I will send you each changed file's diff one by one. After each diff, acknowledge and update your mental model.`;
        this.summarize_file_diff =
            summarize_file_diff ||
                `File: \`$filename\`
Language/type: $file_type

\`\`\`diff
$file_diff
\`\`\`

Analyze this diff and note:
- What changed (added/removed/modified logic)
- Any bugs, errors, or issues you spot with suggested fixes
- Security concerns if any
- Code quality observations

Keep notes — I will ask for a final summary after all files.`;
        this.summarize_final =
            summarize_final ||
                `Now that you've seen all the changed files, write a **comprehensive PR review** in this exact markdown format:

## 📋 PR Summary
A 2-3 sentence plain-English explanation of what this PR does and why.

## 📝 What Changed
A bullet-point breakdown of the key changes across files.

## 🐛 Bugs & Errors Found
For each issue found:
- **File**: \`filename\`
- **Problem**: Describe the bug/error clearly
- **Fix**:
\`\`\`language
// corrected code here
\`\`\`

If no bugs found, write: ✅ No bugs detected.

## ⚠️ Warnings & Code Quality
Minor issues, code smells, or suggestions (non-blocking).

## 🔒 Security Notes
Any security concerns spotted. If none: ✅ No security issues detected.

## 🚀 Release Notes
A user-facing changelog entry (1-3 sentences) suitable for a CHANGELOG.md.

## ✅ Verdict
LGTM 👍 / Needs Changes 🔄 / Critical Issues 🚨 — with a one-line reason.`;
        this.summarize_release_notes =
            summarize_release_notes ||
                `Based on the PR titled "$title" and description "$description", write a concise release note entry (2-3 sentences max) suitable for a public changelog. Focus on user-facing impact.`;
        this.comment_reply =
            comment_reply ||
                `You are a code review assistant replying to a developer comment on a pull request.

**PR Title:** $title
**File being discussed:** $filename

**Relevant code diff:**
\`\`\`diff
$file_diff
\`\`\`

**The developer asked:**
$comment

Reply helpfully and concisely. If they're asking about a bug or fix, provide corrected code. If asking for explanation, be clear and educational. Keep it conversational.`;
    }
    render(template, vars) {
        let result = template;
        for (const [key, value] of Object.entries(vars)) {
            result = result.replace(new RegExp(`\\$${key}`, 'g'), value);
        }
        return result;
    }
}
exports.Prompts = Prompts;
//# sourceMappingURL=options.js.map