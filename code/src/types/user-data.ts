export type GptRequestUserData = {
    pageContent: string;
    remainingTokens: number;
    pageUrl: string;
    snapshotKey?: string;
    sentContentKey?: string;
};
