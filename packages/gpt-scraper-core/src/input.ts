import { ProxyConfigurationOptions, GlobInput, RequestOptions } from '@crawlee/core';
import { Schema } from './types/model';

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
    schema?: Schema | undefined;
    useStructureOutput?: boolean;
}

export const HTML_TAGS_TO_IGNORE = ['script', 'style', 'noscript'];
