import { AnySchema } from 'ajv';
import { ApifyClient } from 'apify-client';

export interface ModelConfig {
    modelName: string;
    maxTokens: number;
    maxOutputTokens?: number;
    interface: 'chat' | 'text';
    cost?: Cost;
}

export interface Usage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

export interface Cost {
    input: number; // USD cost per 1000 tokens
    output: number; // USD cost per 1000 tokens
}

export interface ProcessInstructionsOptions {
    instructions: string;
    content: string;
    apifyClient: ApifyClient;
    schema?: AnySchema;
}

export interface ProcessedInstructions {
    answer: string | null;
    jsonAnswer: object | null;
    usage: Usage | null;
}

export interface ModelStats {
    apiCallsCount: number;
    usage: Usage;
    finalCostUSD: number;
}
