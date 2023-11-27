import { ProxyConfigurationOptions, GlobInput, RequestOptions } from '@crawlee/core';
import { AnySchema } from 'ajv';
import { PAGE_FORMAT } from '@packages/gpt-scraper-core';

/**
 * Input schema in TypeScript format.
 */
export interface Input {
    startUrls: RequestOptions[];
    globs: GlobInput[];
    linkSelector?: string;
    openaiApiKey: string;
    instructions: string;
    model: string;
    targetSelector?: string;
    maxPagesPerCrawl: number;
    maxCrawlingDepth: number;
    proxyConfiguration: ProxyConfigurationOptions;
    schema?: AnySchema | undefined;
    useStructureOutput?: boolean;
    pageFormatInRequest?: PAGE_FORMAT;
}

export const HTML_TAGS_TO_IGNORE = ['script', 'style', 'noscript'];
