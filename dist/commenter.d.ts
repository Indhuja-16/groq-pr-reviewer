export declare class Commenter {
    private octokit;
    private owner;
    private repo;
    private readonly REVIEW_TAG;
    private readonly SUMMARY_TAG;
    constructor();
    upsertReviewComment(prNumber: number, body: string): Promise<void>;
    replyToComment(prNumber: number, commentId: number, body: string): Promise<void>;
    getPRDiff(prNumber: number): Promise<string>;
    getPRFiles(prNumber: number): Promise<Array<{
        filename: string;
        status: string;
        additions: number;
        deletions: number;
        patch?: string;
    }>>;
    getPRDetails(prNumber: number): Promise<{
        title: string;
        body: string;
        author: string;
        base: string;
        head: string;
        commits: number;
    }>;
    getComment(commentId: number): Promise<{
        body: string;
        user: string;
    } | null>;
    getReviewCommentContext(commentId: number): Promise<{
        filename: string;
        diff_hunk: string;
        body: string;
    } | null>;
    private findComment;
    getFileType(filename: string): string;
}
//# sourceMappingURL=commenter.d.ts.map