import { ProxyConfigurationOptions, GlobInput, RequestOptions } from '@crawlee/core';
import { AnySchema } from 'ajv';

/**
 * Input schema in TypeScript format.
 */
export interface Input {
    startUrls: RequestOptions[];
    globs: GlobInput[];
    linkSelector?: string;
    instructions: string;
    targetSelector?: string;
    maxPagesPerCrawl: number;
    maxCrawlingDepth: number;
    proxyConfiguration: ProxyConfigurationOptions;
    schema?: AnySchema;
    useStructureOutput?: boolean;
}
