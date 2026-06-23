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
exports.Commenter = void 0;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
class Commenter {
    constructor() {
        // Tag embedded in comments so we can find and update them
        this.REVIEW_TAG = '<!-- groq-pr-reviewer:review -->';
        this.SUMMARY_TAG = '<!-- groq-pr-reviewer:summary -->';
        const token = process.env.GITHUB_TOKEN;
        if (!token) {
            throw new Error('GITHUB_TOKEN is not set');
        }
        this.octokit = github.getOctokit(token);
        this.owner = github.context.repo.owner;
        this.repo = github.context.repo.repo;
    }
    // Post or update the main PR review comment
    async upsertReviewComment(prNumber, body) {
        const taggedBody = `${this.REVIEW_TAG}\n${body}`;
        const existing = await this.findComment(prNumber, this.REVIEW_TAG);
        if (existing) {
            core.info(`[Commenter] Updating existing review comment #${existing.id}`);
            await this.octokit.rest.issues.updateComment({
                owner: this.owner,
                repo: this.repo,
                comment_id: existing.id,
                body: taggedBody
            });
        }
        else {
            core.info(`[Commenter] Creating new review comment on PR #${prNumber}`);
            await this.octokit.rest.issues.createComment({
                owner: this.owner,
                repo: this.repo,
                issue_number: prNumber,
                body: taggedBody
            });
        }
    }
    // Reply to a specific review comment thread
    async replyToComment(prNumber, commentId, body) {
        // Try as a PR review comment first, then as issue comment
        try {
            await this.octokit.rest.pulls.createReplyForReviewComment({
                owner: this.owner,
                repo: this.repo,
                pull_number: prNumber,
                comment_id: commentId,
                body
            });
            core.info(`[Commenter] Replied to review comment #${commentId}`);
        }
        catch {
            // Fallback: post as a regular issue comment
            await this.octokit.rest.issues.createComment({
                owner: this.owner,
                repo: this.repo,
                issue_number: prNumber,
                body
            });
            core.info(`[Commenter] Posted reply as issue comment (fallback)`);
        }
    }
    // Get the PR diff
    async getPRDiff(prNumber) {
        const { data } = await this.octokit.rest.pulls.get({
            owner: this.owner,
            repo: this.repo,
            pull_number: prNumber,
            mediaType: { format: 'diff' }
        });
        return data;
    }
    // Get list of files changed in the PR
    async getPRFiles(prNumber) {
        const files = await this.octokit.paginate(this.octokit.rest.pulls.listFiles, {
            owner: this.owner,
            repo: this.repo,
            pull_number: prNumber,
            per_page: 100
        });
        return files;
    }
    // Get PR metadata
    async getPRDetails(prNumber) {
        const { data } = await this.octokit.rest.pulls.get({
            owner: this.owner,
            repo: this.repo,
            pull_number: prNumber
        });
        return {
            title: data.title,
            body: data.body || '',
            author: data.user?.login || 'unknown',
            base: data.base.ref,
            head: data.head.ref,
            commits: data.commits
        };
    }
    // Get the comment that triggered the action
    async getComment(commentId) {
        try {
            // Try as PR review comment
            const { data } = await this.octokit.rest.pulls.getReviewComment({
                owner: this.owner,
                repo: this.repo,
                comment_id: commentId
            });
            return { body: data.body, user: data.user?.login || 'unknown' };
        }
        catch {
            try {
                // Fallback: issue comment
                const { data } = await this.octokit.rest.issues.getComment({
                    owner: this.owner,
                    repo: this.repo,
                    comment_id: commentId
                });
                return { body: data.body || '', user: data.user?.login || 'unknown' };
            }
            catch {
                return null;
            }
        }
    }
    // Get PR review comment context (file + diff) for a given comment ID
    async getReviewCommentContext(commentId) {
        try {
            const { data } = await this.octokit.rest.pulls.getReviewComment({
                owner: this.owner,
                repo: this.repo,
                comment_id: commentId
            });
            return {
                filename: data.path,
                diff_hunk: data.diff_hunk,
                body: data.body
            };
        }
        catch {
            return null;
        }
    }
    // Find an existing comment by its tag
    async findComment(prNumber, tag) {
        const comments = await this.octokit.paginate(this.octokit.rest.issues.listComments, {
            owner: this.owner,
            repo: this.repo,
            issue_number: prNumber,
            per_page: 100
        });
        for (const comment of comments) {
            if (comment.body?.includes(tag)) {
                return { id: comment.id };
            }
        }
        return null;
    }
    // Detect file type from filename for better prompting
    getFileType(filename) {
        const ext = filename.split('.').pop()?.toLowerCase() || '';
        const typeMap = {
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
        };
        return typeMap[ext] || ext.toUpperCase() || 'Unknown';
    }
}
exports.Commenter = Commenter;
//# sourceMappingURL=commenter.js.map