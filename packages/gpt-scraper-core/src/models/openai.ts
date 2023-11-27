import { log } from 'crawlee';
import retry, { RetryFunction } from 'async-retry';
import { ChatOpenAI } from 'langchain/chat_models/openai';
import { OpenAI } from 'langchain/llms/openai';
import { LLMResult } from 'langchain/schema';
import { OpenaiAPIError } from '../errors.js';
import { tryToParseJsonFromString } from '../processors.js';
import { ProcessInstructionsOptions } from '../types/model.js';
import { OpenAIModelSettings } from '../types/models.js';
import { GeneralModelHandler } from './model.js';

// TODO: refactor: make this error modular with other non-OpenAI models
export const tryWrapInOpenaiError = (error: any) => {
    if (error?.response?.data?.error) {
        return new OpenaiAPIError(error.response.data.error.message || error.response.data.error.code);
    }
    return error;
};

export class OpenAIModelHandler extends GeneralModelHandler<OpenAIModelSettings> {
    async processInstructions(options: ProcessInstructionsOptions<OpenAIModelSettings>) {
        const { instructions, content, schema, modelSettings } = options;
        log.debug(`Calling Openai API with model ${this.modelConfig.modelName}`);

        const handleLLMEndCallback = this.handleLLMEndCallbackHandler();
        const modelOptions = {
            ...modelSettings,
            modelName: this.modelConfig.modelName,
            callbacks: [{ handleLLMEnd: handleLLMEndCallback.handleLLMEnd }],
        };

        const isChatModel = this.modelConfig.interface === 'chat';
        const baseModel = isChatModel ? new ChatOpenAI(modelOptions) : new OpenAI(modelOptions);

        const useSchema = baseModel instanceof ChatOpenAI && schema;
        const model = useSchema ? this.buildModelWithSchemaFunction(baseModel, instructions, schema) : baseModel;
        const chain = this.buildLLMChain(model);

        const result = await chain.call({ instructions, content });
        const answer = result.text || null;

        const output = handleLLMEndCallback.getOutput();
        const usage = output.llmOutput?.tokenUsage || null;
        const functionArguments = this.parseFunctionArguments(output);

        const possibleJsonAnswer = functionArguments || answer;
        const jsonAnswer = possibleJsonAnswer ? tryToParseJsonFromString(possibleJsonAnswer) : null;

        return { answer, jsonAnswer, usage };
    }

    /**
     * Calls processInstructions with exponential backoff.
     *
     * // TODO: refactor: perhaps we can achieve this with only crawlee?
     */
    processInstructionsWithRetry = (options: ProcessInstructionsOptions<OpenAIModelSettings>) => {
        const process: RetryFunction<any> = async (stopTrying: (e: Error) => void, attempt: number) => {
            try {
                return await this.processInstructions(options);
            } catch (error: any) {
                // NOTE: OpenAI API returns 429 with insufficient_quota, user needs to buy a plan.
                if (error?.response?.status === 429 && error.response?.data?.error?.type === 'insufficient_quota') {
                    stopTrying(error);
                    return;
                }
                if (![429, 500, 503].includes(error?.response?.status)) {
                    stopTrying(error);
                    return;
                }
                // Add rate limit error to stats, the autoscaled pool will use it to scale down the pool.
                if (error?.response?.status === 429) options.apifyClient.stats.addRateLimitError(attempt);
                log.warning(`OpenAI API error, retrying...`, {
                    error: error.response?.data?.error?.message || error.message,
                    statusCode: error?.response?.status,
                    attempt,
                });
                throw error;
            }
        };
        return retry(process, {
            retries: 8,
            minTimeout: 500,
        });
    };

    /**
     * Builds the model with the given schema function. Functions are a more direct way of extracting data to JSON on OpenAI.
     * - It's not guaranteed that the function will return JSON, so we need to properly parse it.
     */
    private buildModelWithSchemaFunction = (
        model: ChatOpenAI,
        instructions: string,
        schema: Record<string, unknown>,
    ) => {
        return model.bind({
            functions: [{ name: 'extract_function', description: instructions, parameters: schema }],
            function_call: { name: 'extract_function' },
        });
    };

    /**
     * Parses the function arguments from the OpenAI LLM's output.
     */
    private parseFunctionArguments = (functionOutput: LLMResult): string | null => {
        const generations = functionOutput.generations as any;
        const firstFunction = generations?.[0]?.[0]?.message;
        const functionArguments = firstFunction?.lc_kwargs?.additional_kwargs?.function_call?.arguments;

        return functionArguments || null;
    };
}
