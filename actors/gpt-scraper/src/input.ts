import { Input as PackageInput } from '@packages/gpt-scraper-core';

/**
 * Input schema in TypeScript format.
 * - Modify the core package schema to fit the Actor's input.
 */
export interface Input extends Omit<PackageInput, 'openaiApiKey' | 'model'> {}
