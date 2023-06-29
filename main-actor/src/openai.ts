import { log } from 'crawlee';
import { encode } from 'gpt-3-encoder';
import { Configuration, OpenAIApi, CreateCompletionResponseUsage } from 'openai';
import retry, { RetryFunction } from 'async-retry';
import { type ApifyClient } from 'apify-client';
import { AnySchema } from 'ajv';
import { OpenaiAPIError } from './errors.js';
import { tryToParseJsonFromString } from './processors.js';

export const getOpenAIClient = (apiKey: string, organization?: string) => {
    const configuration = new Configuration({
        apiKey,
        organization,
    });
    return new OpenAIApi(configuration);
};

interface OpenaiAPICost {
    input: number; // USD cost per 1000 tokens
    output: number; // USD cost per 1000 tokens
}

interface GPTModelConfig {
    model: string;
    maxTokens: number;
    maxOutputTokens?: number;
    interface: 'text' | 'chat';
    cost?: OpenaiAPICost; // USD cost per 1000 tokens
}

interface ProcessInstructionsOptions {
    modelConfig: GPTModelConfig;
    openai: OpenAIApi;
    apifyClient: ApifyClient;
    instructions: string;
    schema?: AnySchema;
    content: string;
}

/**
 * List of GPT models that can be used.
 * Should be in sync with https://platform.openai.com/docs/models/
 */
export const GPT_MODEL_LIST: {[key: string]: GPTModelConfig} = {
    'text-davinci-003': {
        model: 'text-davinci-003',
        maxTokens: 4097,
        interface: 'text',
    },
    'gpt-3.5-turbo': {
        model: 'gpt-3.5-turbo',
        maxTokens: 4097,
        interface: 'chat',
        cost: {
            input: 0.0015,
            output: 0.002,
        },
    },
    'gpt-3.5-turbo-16k': {
        model: 'gpt-3.5-turbo-16k',
        maxTokens: 16384,
        interface: 'chat',
        cost: {
            input: 0.003,
            output: 0.004,
        },
    },
    // TODO: Remove this model after June 27th, 2023
    // https://platform.openai.com/docs/models/gpt-3-5
    'gpt-3.5-turbo-0613': {
        model: 'gpt-3.5-turbo-0613',
        interface: 'chat',
        maxTokens: 4096,
        cost: {
            input: 0.0015,
            output: 0.002,
        },
    },
    'text-davinci-002': {
        model: 'text-davinci-002',
        maxTokens: 4096,
        interface: 'text',
    },
    'code-davinci-002': {
        model: 'code-davinci-002',
        maxTokens: 8001,
        interface: 'text',
    },
    'gpt-4': {
        model: 'gpt-4',
        maxTokens: 8192,
        interface: 'chat',
        cost: {
            input: 0.03,
            output: 0.06,
        },
    },
    'gpt-4-32k': {
        model: 'gpt-4',
        maxTokens: 32768,
        interface: 'chat',
        cost: {
            input: 0.06,
            output: 0.12,
        },
    },
};

export const getNumberOfTextTokens = (text: string) => {
    const encodedText = encode(text);
    return encodedText.length;
};

export const validateGPTModel = (model: string) => {
    const modelConfig = GPT_MODEL_LIST[model];
    if (!modelConfig) {
        throw new Error(`Model ${model} is not supported`);
    }
    return modelConfig;
};

export const rethrowOpenaiError = (error: any) => {
    if (error?.response?.data?.error) {
        return new OpenaiAPIError(error.response.data.error.message || error.response.data.error.code);
    }
    return error;
};

/**
 * Calls OpenAI API and process content with user instructions.
 * @param modelConfig
 * @param openai
 * @param instructions
 * @param content
 * @param schema
 */
export const processInstructions = async ({
    modelConfig,
    openai,
    instructions,
    content,
    schema,
} : ProcessInstructionsOptions): Promise<object> => {
    let answer: string | null = null;
    let jsonAnswer: null | object = null;
    let usage = {} as CreateCompletionResponseUsage;
    const promptTokenLength = getNumberOfTextTokens(`${instructions}\`\`\`${content}\`\`\``);
    const maxTokensNeeded = modelConfig.maxTokens - promptTokenLength - 150;
    // Limits tokens to maxOutputTokens if defined
    const maxTokens = modelConfig.maxOutputTokens ? Math.min(maxTokensNeeded, modelConfig.maxOutputTokens) : maxTokensNeeded;
    log.debug(`Calling Openai API with model ${modelConfig.model}`, { promptTokenLength });
    if (modelConfig.interface === 'text') {
        if (schema) {
            log.warning(`Schema is not supported for model ${modelConfig.model}`);
        }
        const completion = await openai.createCompletion({
            model: modelConfig.model,
            prompt: `${instructions}\`\`\`${content}\`\`\``,
            max_tokens: maxTokens,
        });
        answer = completion?.data?.choices[0]?.text || '';
        jsonAnswer = tryToParseJsonFromString(answer);
        if (completion?.data?.usage) usage = completion?.data?.usage;
    } else if (modelConfig.interface === 'chat') {
        const conversationOpts = {
            model: modelConfig.model,
            max_tokens: maxTokens,
        };
        let conversation;
        if (schema) {
            conversation = await openai.createChatCompletion({
                ...conversationOpts,
                messages: [
                    {
                        role: 'user',
                        content,
                    },
                ],
                functions: [
                    {
                        name: 'extract_function',
                        description: instructions,
                        // @ts-ignore
                        parameters: schema,
                    },
                ],
            });
            if (conversation?.data?.choices[0]?.message?.function_call && conversation?.data?.choices[0]?.message?.function_call?.arguments) {
                jsonAnswer = JSON.parse(conversation?.data?.choices[0]?.message?.function_call?.arguments);
            }
            answer = conversation?.data?.choices[0]?.message?.content || null;
        } else {
            conversation = await openai.createChatCompletion({
                ...conversationOpts,
                messages: [
                    {
                        role: 'user',
                        content: `${instructions}\`\`\`${content}\`\`\``,
                    },
                ],
            });
            answer = conversation?.data?.choices[0]?.message?.content || '';
            jsonAnswer = tryToParseJsonFromString(answer);
        }
        if (conversation?.data?.usage) usage = conversation?.data?.usage;
    } else {
        throw new Error(`Unsupported interface ${modelConfig.interface}`);
    }
    return {
        answer,
        jsonAnswer,
        usage,
    };
};

/**
 * Calls processInstructions with exponential backoff.
 * @param options
 */
export const processInstructionsWithRetry = (options: ProcessInstructionsOptions) => {
    const process: RetryFunction<any> = async (stopTrying: (e: Error) => void, attempt: number) => {
        try {
            return await processInstructions(options);
        } catch (error: any) {
            if (![429, 500, 503].includes(error?.response?.status)) {
                stopTrying(error);
            }
            // Add rate limit error to stats, the autoscaled pool will use it to scale down the pool.
            if (error?.response?.status === 429) options.apifyClient.stats.addRateLimitError(attempt);
            throw error;
        }
    };
    return retry(process, {
        retries: 8,
        minTimeout: 500,
    });
};

export class OpenaiAPIUsage {
    model: string;
    apiCallsCount: number;
    usage: CreateCompletionResponseUsage;
    finalCostUSD: number;
    cost: OpenaiAPICost;
    constructor(model: string) {
        this.model = model;
        this.cost = GPT_MODEL_LIST[model].cost || { input: 0, output: 0 };
        this.apiCallsCount = 0;
        this.finalCostUSD = 0;
        this.usage = {
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
        };
    }

    logApiCallUsage(usage: CreateCompletionResponseUsage) {
        this.apiCallsCount += 1;
        Object.keys(this.usage).forEach((key: string) => {
            // @ts-ignore
            this.usage[key] += usage[key] || 0;
        });
        this.finalCostUSD += this.cost.input * (usage.prompt_tokens / 1000);
        this.finalCostUSD += this.cost.output * (usage.completion_tokens / 1000);
    }
}
