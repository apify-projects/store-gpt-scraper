import { ChatOpenAI, OpenAI } from '@langchain/openai';
import { AnySchema } from 'ajv';
import { log, sleep } from 'crawlee';
import { LLMResult } from 'langchain/schema';

import { GeneralModelHandler } from './model.js';
import {
    DESCRIPTION_LENGTH_ERROR,
    DESCRIPTION_LENGTH_ERROR_LOG_MESSAGE,
    NonRetryableOpenaiAPIError,
    OpenaiAPIError,
    OpenaiAPIErrorToExitActor,
    REPETITIVE_PROMPT_ERROR_MESSAGE,
    RateLimitedError,
} from '../errors.js';
import { tryToParseJsonFromString } from '../processors.js';
import { FunctionArgumentsGenerations, LangchainError } from '../types/langchain-types.js';
import { ProcessInstructionsOptions } from '../types/model.js';
import { OpenAIModelSettings } from '../types/models.js';

const MAX_GPT_RETRIES = 8;

/**
 * Wraps the error in a custom error class. Used for the handling errors.
 * - Langchain doesn't have a proper error type, so we need to normalize it.
 * - The error message attribute changes depending on the error type.
 *
 * see OpenAI errors documentation: https://platform.openai.com/docs/guides/error-codes/api-errors
 */
const wrapInOpenaiError = (error: LangchainError): OpenaiAPIError => {
    const errorMessage = error.error?.message || error.code || error.message;
    if (!errorMessage) return new OpenaiAPIError('Unknown error from langchain');

    // The error structure is completely different for insufficient quota errors. We need to handle it separately.
    if (error.name === 'InsufficientQuotaError') {
        return new OpenaiAPIErrorToExitActor(errorMessage);
    }

    const isOpenAIServerError = [500, 503].includes(error.status);
    if (isOpenAIServerError) return new OpenaiAPIError(errorMessage, error.status);

    if (error.status === 429) return new RateLimitedError(errorMessage);

    const isRepetitivePromptError = error.status === 400 && errorMessage.includes('repetitive patterns');
    if (isRepetitivePromptError) return new NonRetryableOpenaiAPIError(REPETITIVE_PROMPT_ERROR_MESSAGE);

    const isDescriptionLengthError = error.status === 400 && errorMessage.endsWith(DESCRIPTION_LENGTH_ERROR);
    if (isDescriptionLengthError) {
        return new OpenaiAPIErrorToExitActor(DESCRIPTION_LENGTH_ERROR_LOG_MESSAGE, error.status);
    }

    return new OpenaiAPIErrorToExitActor(errorMessage, error.status);
};

export class OpenAIModelHandler extends GeneralModelHandler<OpenAIModelSettings> {
    async processInstructions(options: ProcessInstructionsOptions<OpenAIModelSettings>) {
        const { instructions, content, schema, schemaDescription, modelSettings } = options;
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
        const model = useSchema ? this.buildModelWithSchemaFunction(baseModel, schemaDescription, schema) : baseModel;
        const chain = this.buildLLMChain(model);

        const result = await chain.call({ instructions, content });
        const answer = result.text || null;

        const output = handleLLMEndCallback.getOutput();
        const usage = output.llmOutput?.tokenUsage || null;
        const functionArguments = this.parseFunctionArguments(output);

        const possibleJsonAnswer = functionArguments || answer;
        const jsonAnswer = possibleJsonAnswer ? tryToParseJsonFromString(possibleJsonAnswer) : null;

        // it may return just function arguments (jsonAnswer), but if jsonAnswer is present, then `answer` should be too,
        // so default `answer` to the unparsed value of `jsonAnswer`
        return { answer: answer ?? possibleJsonAnswer, jsonAnswer, usage };
    }

    /**
     * Calls processInstructions with exponential backoff.
     */
    processInstructionsWithRetry = async (options: ProcessInstructionsOptions<OpenAIModelSettings>) => {
        for (let retry = 1; retry < MAX_GPT_RETRIES + 1; retry++) {
            try {
                return await this.processInstructions(options);
            } catch (error) {
                const wrappedError = wrapInOpenaiError(error as LangchainError);

                if (wrappedError instanceof NonRetryableOpenaiAPIError) throw wrappedError;

                log.warning(`OpenAI API error, retrying...`, {
                    error: wrappedError.message,
                    statusCode: wrappedError.statusCode,
                    attempt: retry,
                });

                // Add rate limit error to stats, the autoscaled pool will use it to scale down the pool.
                if (wrappedError instanceof RateLimitedError) options.apifyClient.stats.addRateLimitError(retry);

                // Exponential backoff
                // TODO: improve this for rate limit errors - we should use the value from 'retry-after' header
                // - (not sure if that is available in langchain though...)
                const timeout = 500 * retry ** 2;
                await sleep(timeout);
            }
        }

        throw new Error(`OpenAI API failed after ${MAX_GPT_RETRIES} retries`);
    };

    /**
     * Builds the model with the given schema function. Functions are a more direct way of extracting data to JSON on OpenAI.
     * - It's not guaranteed that the function will return JSON, so we need to properly parse it.
     */
    private buildModelWithSchemaFunction = (model: ChatOpenAI, description: string, schema: AnySchema) => {
        const parameters = schema as Record<string, unknown>;

        return model.bind({
            functions: [{ name: 'extract_function', description, parameters }],
            function_call: { name: 'extract_function' },
        });
    };

    /**
     * Parses the function arguments from the OpenAI LLM's output.
     */
    private parseFunctionArguments = (functionOutput: LLMResult): string | null => {
        const generations = functionOutput.generations as FunctionArgumentsGenerations;
        const firstFunction = generations?.[0]?.[0]?.message;
        const functionArguments = firstFunction?.lc_kwargs?.additional_kwargs?.function_call?.arguments;

        return functionArguments || null;
    };
}

/** Used for unit testing */
// eslint-disable-next-line no-underscore-dangle
export const _private = {
    wrapInOpenaiError,
};
