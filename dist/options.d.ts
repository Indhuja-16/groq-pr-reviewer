export declare class Options {
    debug: boolean;
    max_files: number;
    review_comment_lgtm: boolean;
    path_filters: PathFilter;
    system_message: string;
    groq_model: string;
    groq_model_temperature: number;
    groq_retries: number;
    groq_timeout_ms: number;
    groq_concurrency_limit: number;
    bot_name: string;
    constructor(debug: boolean, max_files?: string, review_comment_lgtm?: boolean, path_filters?: string[], system_message?: string, groq_model?: string, groq_model_temperature?: string, groq_retries?: string, groq_timeout_ms?: string, groq_concurrency_limit?: string, bot_name?: string);
    print(): void;
    check_path(path: string): boolean;
}
export declare class PathFilter {
    private readonly rules;
    constructor(rules?: string[]);
    check(path: string): boolean;
}
export declare class Prompts {
    summarize_beginning: string;
    summarize_file_diff: string;
    summarize_final: string;
    summarize_release_notes: string;
    comment_reply: string;
    constructor(summarize_beginning?: string, summarize_file_diff?: string, summarize_final?: string, summarize_release_notes?: string, comment_reply?: string);
    render(template: string, vars: Record<string, string>): string;
}
//# sourceMappingURL=options.d.ts.map