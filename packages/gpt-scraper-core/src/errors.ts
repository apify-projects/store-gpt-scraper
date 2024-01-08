/* eslint-disable max-classes-per-file */

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
 * Error from OpenAI API. This error indicates that the request should not be retried.
 */
export class NonRetryableOpenaiAPIError extends OpenaiAPIError {}

/**
 * Error from OpenAI API. Indicates that the request should be retried after a while.
 */
export class RateLimitedError extends OpenaiAPIError {}
