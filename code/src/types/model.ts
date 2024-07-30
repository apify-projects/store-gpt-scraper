import { AnySchema } from 'ajv';
import { ApifyClient } from 'apify-client';

export interface ModelConfig {
    modelName: string;
    maxTokens: number;
    maxOutputTokens?: number;
    interface: 'chat' | 'text';
    cost?: Cost;
    /** Only used for cases where we need to limit the token limit earlier than the actual maximum (e.g. our PPR Actor) */
    limitGenerationTokens?: true;
}

export interface Usage {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
}

export interface Cost {
    /** USD cost per 1000 tokens */
    input: number;
    /** USD cost per 1000 tokens */
    output: number;
}

export interface ProcessInstructionsOptions<ModelSettings extends object> {
    instructions: string;
    content: string;
    apifyClient: ApifyClient;
    modelSettings: ModelSettings;
    schema?: AnySchema;
    schemaDescription: string;
    remainingTokens: number;
}

export interface ProcessedInstructions {
    answer: string | null;
    jsonAnswer: object | null;
    usage: Usage | null;
}

export interface ModelStats {
    apiCallsCount: number;
    usdUsage: number;
    usage: Usage;
}
