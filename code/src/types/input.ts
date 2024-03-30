import { AnySchema } from 'ajv';
import { Cookie, GlobInput, ProxyConfigurationOptions, RequestOptions } from 'crawlee';
import { ACTORS } from './actors.js';
import { OpenAIModelSettings } from './models.js';
import { ValuesOf } from './utils.js';

/**
 * Input schema in TypeScript format.
 */
export type Input = (OpenAIModelSettings & DeprecatedInput) & {
    dynamicContentWaitSecs?: number;
    startUrls: RequestOptions[];
    includeUrlGlobs?: GlobInput[];
    excludeUrlGlobs?: GlobInput[];
    linkSelector?: string;
    openaiApiKey: string;
    instructions: string;
    model: string;
    targetSelector?: string;
    maxPagesPerCrawl: number;
    maxCrawlingDepth: number;
    proxyConfiguration: ProxyConfigurationOptions;
    schema?: AnySchema;
    schemaDescription?: string;
    useStructureOutput?: boolean;
    pageFormatInRequest?: PAGE_FORMAT;
    saveSnapshots?: boolean;
    skipGptGlobs?: GlobInput[];
    initialCookies?: Cookie[];
    removeElementsCssSelector?: string;
    removeLinkUrls?: boolean;
    actorType: ValuesOf<typeof ACTORS>;
};

export enum PAGE_FORMAT {
    HTML = 'HTML',
    MARKDOWN = 'Markdown',
}

type DeprecatedInput = {
    globs?: GlobInput[];
};
