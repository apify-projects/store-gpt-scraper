export type UserData = {
    startUrl: string;
};

export type CrawlRouteUserData = UserData & {
    depth?: number;
    wasOpenedKey: string;
};

export type GptRequestUserData = {
    pageContent: string;
    remainingTokens: number;
    pageUrl: string;
    snapshotKey?: string;
    sentContentKey?: string;
};
