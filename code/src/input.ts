import { Actor } from 'apify';

import { Input } from './types/input.js';

/**
 * Adjusts the input to be backwards compatible with old input formats.
 */
export const adjustDeprecatedInput = async (input: Input) => {
    let { includeUrlGlobs } = input;

    if (input.globs) {
        await Actor.setStatusMessage(
            'Deprecation warning: `globs` input field is deprecated, please use `includeUrlGlobs` instead!',
            { level: 'WARNING' },
        );
        includeUrlGlobs = input.globs;
    }

    return { ...input, includeUrlGlobs };
};

export const getOpenAiApiKeyEnvOrFail = () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) return apiKey;

    throw new Error('OPENAI_API_KEY is not set!');
};
