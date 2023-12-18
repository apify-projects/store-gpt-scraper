import { AnySchema } from 'ajv';
import { GlobInput, ProxyConfigurationOptions, RequestOptions } from 'crawlee';
import { OpenAIModelSettings } from './models';

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
    schema?: AnySchema | undefined;
    useStructureOutput?: boolean;
    pageFormatInRequest?: PAGE_FORMAT;
    saveSnapshots?: boolean;
}

export const HTML_TAGS_TO_IGNORE = ['script', 'style', 'noscript'];
export enum PAGE_FORMAT {
    HTML = 'HTML',
    MARKDOWN = 'Markdown',
}
