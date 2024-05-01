/* eslint-disable max-classes-per-file */

export const REPETITIVE_PROMPT_ERROR_MESSAGE = 'OpenAI has rejected a page prompt because it contains repetitive '
    + 'patterns. This usually happens when the website you are trying to scrape has some repetitive content. Please '
    + 'try to remove the repetitive content via the `removeElementsCssSelector` input option. Skipping GPT processing '
    + 'for this page!';

export const DESCRIPTION_LENGTH_ERROR = "is too long - 'functions.0.description'";
export const DESCRIPTION_LENGTH_ERROR_LOG_MESSAGE = 'Schema function description is too long, please shorten it to a '
    + 'maximum of 1280 characters.\n\t- TIP: You can use `instructions` separately from `schemaDescription` to '
    + 'provide more context.';

export const ERROR_OCCURRED_MESSAGE = "An error has occurred in your run. Please check the run's logs for more info.";

/**
 * Error from OpenAI API.
 */
export class OpenaiAPIError extends Error {
    statusCode?: number;

    constructor(message?: string, statusCode?: number) {
        const name = 'OpenaiAPIError';
        const tuneMessage = `OpenaiAPIError: ${message || 'Internal Error'}`;
        super(message);
        this.name = name;
        this.message = tuneMessage;
        this.statusCode = statusCode;
    }
}

/**
 * Error from OpenAI API. Indicates that the request should not be retried.
 */
export class NonRetryableOpenaiAPIError extends OpenaiAPIError {}

/**
 * Error from OpenAI API. Indicates that we should exit the Actor with it.
 */
export class OpenaiAPIErrorToExitActor extends NonRetryableOpenaiAPIError {}

/**
 * Error from OpenAI API. Indicates that the request should be retried after a while.
 */
export class RateLimitedError extends OpenaiAPIError {}
