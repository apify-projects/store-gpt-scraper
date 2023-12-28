import { GlobInput } from '@crawlee/core';
import { Input as PackageInput } from '@packages/gpt-scraper-core';
import { Actor } from 'apify';

type DeprecatedInput = {
    globs?: GlobInput[];
};

/**
 * Input schema in TypeScript format.
 * - Modify the core package schema to fit the Actor's input.
 */
export type Input = Omit<PackageInput, 'openaiApiKey' | 'model'> & DeprecatedInput;

/**
 * This function is not pure and modifies the provided input object.
 */
export const updateDeprecatedInput = async (input: Input) => {
    if (input.globs) {
        await Actor.setStatusMessage(
            'Deprecation warning: `globs` input field is deprecated, please use `includeUrlGlobs` instead!',
            { level: 'WARNING' },
        );
        input.includeUrlGlobs = input.globs;
    }
};
