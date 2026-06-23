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
exports.handleReviewComment = handleReviewComment;
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const commenter_js_1 = require("./commenter.js");
async function handleReviewComment(bot, options, prompts) {
    const commenter = new commenter_js_1.Commenter();
    const context = github.context;
    const payload = context.payload;
    // Works for both pull_request_review_comment and issue_comment events
    const commentId = payload.comment?.id;
    const prNumber = payload.pull_request?.number ?? payload.issue?.number;
    if (!commentId || !prNumber) {
        core.warning('[Comment] Could not find comment ID or PR number');
        return;
    }
    // ── 1. Get the triggering comment ─────────────────────────────────────────
    const commentData = await commenter.getComment(commentId);
    if (!commentData) {
        core.warning(`[Comment] Could not fetch comment #${commentId}`);
        return;
    }
    const { body: commentBody, user: commentAuthor } = commentData;
    // Check if this comment mentions the bot
    const botMention = `@${options.bot_name}`;
    if (!commentBody.toLowerCase().includes(botMention.toLowerCase())) {
        core.info(`[Comment] Comment does not mention ${botMention}, skipping`);
        return;
    }
    // Don't reply to ourselves
    if (commentAuthor === options.bot_name || commentAuthor === 'github-actions[bot]') {
        core.info('[Comment] Comment is from the bot itself, skipping');
        return;
    }
    core.info(`[Comment] Handling @${options.bot_name} mention from @${commentAuthor} on PR #${prNumber}`);
    // ── 2. Strip the bot mention from the question ────────────────────────────
    const userQuestion = commentBody
        .replace(new RegExp(`@${options.bot_name}`, 'gi'), '')
        .trim();
    if (!userQuestion) {
        core.info('[Comment] No question after stripping bot mention');
        return;
    }
    // ── 3. Get PR details for context ─────────────────────────────────────────
    const pr = await commenter.getPRDetails(prNumber);
    // ── 4. Try to get the file context from the review comment ────────────────
    let fileContext = '';
    let filename = 'unknown';
    const reviewCtx = await commenter.getReviewCommentContext(commentId);
    if (reviewCtx) {
        filename = reviewCtx.filename;
        const fileType = commenter.getFileType(filename);
        fileContext = `\n\n**File:** \`${filename}\` (${fileType})\n\n\`\`\`diff\n${bot.truncateDiff(reviewCtx.diff_hunk, 2000)}\n\`\`\``;
    }
    // ── 5. Build prompt and get reply ─────────────────────────────────────────
    const replyPrompt = prompts.render(prompts.comment_reply, {
        title: pr.title,
        filename,
        file_diff: reviewCtx?.diff_hunk || 'No diff context available',
        comment: userQuestion
    });
    core.info(`[Comment] Sending question to model: "${userQuestion.substring(0, 100)}..."`);
    const reply = await bot.oneShot(replyPrompt);
    // ── 6. Post the reply ─────────────────────────────────────────────────────
    const replyBody = `**@${commentAuthor}** — Here's my response:

${reply}

<sub>🤖 Groq PR Reviewer _(${options.groq_model})_</sub>`;
    await commenter.replyToComment(prNumber, commentId, replyBody);
    core.info(`[Comment] ✅ Reply posted to comment #${commentId}`);
}
//# sourceMappingURL=review-comment.js.map