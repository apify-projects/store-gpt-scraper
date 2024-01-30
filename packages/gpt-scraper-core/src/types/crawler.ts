import { AnySchema } from 'ajv';
import { KeyValueStore, PlaywrightCrawlingContext } from 'crawlee';
import { OpenAIModelHandler } from '../models/openai.js';
import { Input, PAGE_FORMAT } from './input.js';
import { OpenAIModelSettings } from './models.js';

export interface CrawlerState {
    pageOutputted: number;
    config: Input;
}

export interface EnrichedContext extends PlaywrightCrawlingContext {
    input: Input;
    pageFormat: PAGE_FORMAT,
    schema: AnySchema | undefined;
    model: OpenAIModelHandler;
    kvStore: KeyValueStore;
    modelSettings: OpenAIModelSettings;
    saveSnapshots: boolean;
}
