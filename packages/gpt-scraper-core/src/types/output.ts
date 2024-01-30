import { Usage } from './model.js';

export type Output = {
    url: string;
    answer: string;
    jsonAnswer: any;
    htmlSnapshotUrl?: string;
    screenshotUrl?: string;
    sentContentUrl?: string;
    '#debug': {
        modelName: string;
        openaiUsage: Usage;
        usdUsage: number;
        apiCallsCount: number;
    };
};
