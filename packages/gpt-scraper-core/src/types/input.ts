import { GlobInput, ProxyConfigurationOptions, RequestOptions } from 'crawlee';
import { Schema } from './model';
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
    schema?: Schema | undefined;
    useStructureOutput?: boolean;
    saveSnapshots?: boolean;
}
