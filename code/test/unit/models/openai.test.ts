import { describe, expect, test } from 'vitest';

import { DESCRIPTION_LENGTH_ERROR_LOG_MESSAGE, NonRetryableOpenaiAPIError } from '../../../src/errors';
import { _private } from '../../../src/models/openai';
import { LangchainError } from '../../../src/types/langchain-types';

const { wrapInOpenaiError } = _private;

describe('wrapInOpenaiError', () => {
    test('should return help error message for "too long function description" error', () => {
        const error = new Error() as LangchainError;
        error.error = { message: "'blah blah too long blah' is too long - 'functions.0.description'" };
        error.status = 400;

        const wrappedError = wrapInOpenaiError(error as LangchainError);

        expect(wrappedError).toBeInstanceOf(NonRetryableOpenaiAPIError);
        expect(wrappedError.message).toBe(`OpenaiAPIError: ${DESCRIPTION_LENGTH_ERROR_LOG_MESSAGE}`);
    });
});
