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
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
const bot_js_1 = require("./bot.js");
const options_js_1 = require("./options.js");
const review_js_1 = require("./review.js");
const review_comment_js_1 = require("./review-comment.js");
async function run() {
    // ── Load options from action inputs ───────────────────────────────────────
    const options = new options_js_1.Options(core.getBooleanInput('debug'), core.getInput('max_files'), core.getBooleanInput('review_comment_lgtm'), core.getMultilineInput('path_filters'), core.getInput('system_message'), core.getInput('groq_model'), core.getInput('groq_model_temperature'), core.getInput('groq_retries'), core.getInput('groq_timeout_ms'), core.getInput('groq_concurrency_limit'), core.getInput('bot_name'));
    if (options.debug) {
        options.print();
        core.info(`[Main] GitHub event: ${process.env.GITHUB_EVENT_NAME}`);
        core.info(`[Main] Repository: ${github.context.repo.owner}/${github.context.repo.repo}`);
    }
    // ── Load prompt templates ─────────────────────────────────────────────────
    const prompts = new options_js_1.Prompts(core.getInput('summarize_beginning'), core.getInput('summarize_file_diff'), core.getInput('summarize_final'), core.getInput('summarize_release_notes'), core.getInput('comment_reply'));
    // ── Initialize Groq bot ───────────────────────────────────────────────────
    let bot;
    try {
        bot = new bot_js_1.Bot(options);
    }
    catch (e) {
        core.setFailed(`Failed to initialize Groq bot: ${e.message}\n\nMake sure GROQ_API_KEY is set in your repository secrets.`);
        return;
    }
    // ── Route to the right handler based on GitHub event ─────────────────────
    const eventName = process.env.GITHUB_EVENT_NAME;
    try {
        if (eventName === 'pull_request' || eventName === 'pull_request_target') {
            core.info('[Main] Handling pull request event → running code review');
            await (0, review_js_1.codeReview)(bot, options, prompts);
        }
        else if (eventName === 'pull_request_review_comment' ||
            eventName === 'issue_comment') {
            core.info('[Main] Handling comment event → checking for bot mention');
            await (0, review_comment_js_1.handleReviewComment)(bot, options, prompts);
        }
        else {
            core.warning(`[Main] Unsupported event: ${eventName}. This action handles: pull_request, pull_request_target, pull_request_review_comment, issue_comment`);
        }
    }
    catch (e) {
        if (e instanceof Error) {
            core.setFailed(`[Main] Action failed: ${e.message}\n${e.stack}`);
        }
        else {
            core.setFailed(`[Main] Action failed: ${String(e)}`);
        }
    }
}
// Handle uncaught errors gracefully
process.on('unhandledRejection', (reason, promise) => {
    core.warning(`Unhandled Promise Rejection: ${reason}`);
});
process.on('uncaughtException', (error) => {
    core.warning(`Uncaught Exception: ${error.message}`);
});
// Run
run();
//# sourceMappingURL=main.js.map