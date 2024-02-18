import { AnySchema } from 'ajv';
import { Cookie, GlobInput, ProxyConfiguration, Request } from 'crawlee';
import { OpenAIModelHandler } from '../models/openai';
import { PAGE_FORMAT } from './input';
import { OpenAIModelSettings } from './models';

/**
 * Parsed input configuration.
 */
export interface Config {
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
    requests: Request[];
    saveSnapshots: boolean;
    schema?: AnySchema;
    schemaDescription: string;
    skipGptGlobs?: GlobInput[];
    targetSelector?: string;
}
