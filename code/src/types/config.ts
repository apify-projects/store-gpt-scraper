import { AnySchema } from 'ajv';
import { Cookie, GlobInput, ProxyConfiguration, Request } from 'crawlee';
import { OpenAIModelHandler } from '../models/openai.js';
import { PAGE_FORMAT } from './input.js';
import { OpenAIModelSettings } from './models.js';

/**
 * Parsed input configuration.
 */
export interface Config {
    dynamicContentWaitSecs: number;
    excludeUrlGlobs?: GlobInput[];
    includeUrlGlobs?: GlobInput[];
    initialCookies?: Cookie[];
    instructions: string;
    linkSelector?: string;
    maxCrawlingDepth: number;
    maxPagesPerCrawl: number;
    model: OpenAIModelHandler;
    modelSettings: OpenAIModelSettings;
    pageFormat: PAGE_FORMAT;
    proxyConfiguration?: ProxyConfiguration;
    removeElementsCssSelector?: string;
    removeLinkUrls: boolean;
    requests: Request[];
    saveSnapshots: boolean;
    schema?: AnySchema;
    schemaDescription: string;
    skipGptGlobs?: GlobInput[];
    targetSelector?: string;
}
