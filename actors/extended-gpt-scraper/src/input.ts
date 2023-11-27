import { ProxyConfigurationOptions, GlobInput, RequestOptions } from '@crawlee/core';
import { OpenAIModelSettings, Schema } from '@packages/gpt-scraper-core';

/**
 * Input schema in TypeScript format.
 */
export interface Input extends OpenAIModelSettings {
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
    schema?: Schema;
    useStructureOutput?: boolean;
    saveSnapshots?: boolean;
}

export const HTML_TAGS_TO_IGNORE = ['script', 'style', 'noscript'];
