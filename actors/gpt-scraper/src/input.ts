import { ProxyConfigurationOptions, GlobInput, RequestOptions } from '@crawlee/core';
import { Schema } from '@packages/gpt-scraper-core';

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
    schema?: Schema;
    useStructureOutput?: boolean;
}
