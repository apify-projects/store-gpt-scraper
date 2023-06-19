import { log } from 'crawlee';
import { encode } from 'gpt-3-encoder';
import { Configuration, OpenAIApi, CreateCompletionResponseUsage } from 'openai';
import { OpenaiAPIError } from './errors.js';

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
            input: 0.002,
            output: 0.002,
        },
    },
    'gpt-3.5-turbo-16k': {
        model: 'gpt-3.5-turbo-16k',
        // maxTokens: 16384,
        // It allows 16,384 tokens, but we set up pricing based on 4097 tokens, but let's allow 8192 tokens.
        maxTokens: 8192,
        // Output tokens are expensive, let's limit them to not go crazy
        maxOutputTokens: 2048,
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
            output: 0.03,
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
        return new OpenaiAPIError(error.response.data.error.message);
    }
    return error;
};

export const processInstructions = async ({
    modelConfig,
    openai,
    prompt,
} : { modelConfig: GPTModelConfig, openai: OpenAIApi, prompt: string }) => {
    let answer = '';
    let usage = {} as CreateCompletionResponseUsage;
    const promptTokenLength = getNumberOfTextTokens(prompt);

    const maxTokensNeeded = modelConfig.maxTokens - promptTokenLength - 150;
    // Limits tokens to maxOutputTokens if defined
    const maxTokens = modelConfig.maxOutputTokens ? Math.min(maxTokensNeeded, modelConfig.maxOutputTokens) : maxTokensNeeded;
    log.debug(`Calling Openai API with model ${modelConfig.model}`, { promptTokenLength });
    if (modelConfig.interface === 'text') {
        const completion = await openai.createCompletion({
            model: modelConfig.model,
            prompt,
            max_tokens: maxTokens,
        });
        answer = completion?.data?.choices[0]?.text || '';
        if (completion?.data?.usage) usage = completion?.data?.usage;
    } else if (modelConfig.interface === 'chat') {
        const conversation = await openai.createChatCompletion({
            model: modelConfig.model,
            messages: [
                {
                    role: 'user',
                    content: prompt,
                },
            ],
            max_tokens: maxTokens,
        });
        answer = conversation?.data?.choices[0]?.message?.content || '';
        if (conversation?.data?.usage) usage = conversation?.data?.usage;
    } else {
        throw new Error(`Unsupported interface ${modelConfig.interface}`);
    }
    return {
        answer,
        usage,
    };
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
