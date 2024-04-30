import { ModelConfig } from '../types/model.js';

/**
 * Returns the corresponding model configuration and handler for the given model name.
 * - Returns null if the model name is not found.
 */
export const getModelConfigByName = (modelName: string): ModelConfig | null => {
    if (!(modelName in OPEN_AI_MODELS)) return null;

    return OPEN_AI_MODELS[modelName];
};

/**
 * List of OpenAI models that can be used.
 * Should be in sync with https://platform.openai.com/docs/models/
 */
const OPEN_AI_MODELS: { [modelKey: string]: ModelConfig } = {
    'text-davinci-003': {
        modelName: 'text-davinci-003',
        maxTokens: 4097,
        interface: 'text',
    },
    'gpt-3.5-turbo': {
        modelName: 'gpt-3.5-turbo',
        maxTokens: 4097,
        interface: 'chat',
        cost: {
            input: 0.0005,
            output: 0.0015,
        },
    },
    'gpt-3.5-turbo-16k': {
        modelName: 'gpt-3.5-turbo-16k',
        maxTokens: 16384,
        interface: 'chat',
        cost: {
            input: 0.003,
            output: 0.004,
        },
    },
    'text-davinci-002': {
        modelName: 'text-davinci-002',
        maxTokens: 4096,
        interface: 'text',
    },
    'code-davinci-002': {
        modelName: 'code-davinci-002',
        maxTokens: 8001,
        interface: 'text',
    },
    'gpt-4': {
        modelName: 'gpt-4',
        maxTokens: 8192,
        interface: 'chat',
        cost: {
            input: 0.03,
            output: 0.06,
        },
    },
    'gpt-4-32k': {
        modelName: 'gpt-4-32k',
        maxTokens: 32768,
        interface: 'chat',
        cost: {
            input: 0.06,
            output: 0.12,
        },
    },
    'gpt-4-turbo': {
        modelName: 'gpt-4-1106-preview',
        maxTokens: 128_000,
        interface: 'chat',
        cost: {
            input: 0.01,
            output: 0.03,
        },
    },
} as const;
