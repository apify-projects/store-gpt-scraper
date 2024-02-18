import { AnySchema } from 'ajv';
import addFormats from 'ajv-formats';
import Ajv2020 from 'ajv/dist/2020';
import { Actor } from 'apify';
import { Cookie, KeyValueStore, RequestList, log } from 'crawlee';
import { Page } from 'playwright';
import { getModelByName } from './models/models';
import { OpenAIModelHandler } from './models/openai';
import { OpenAIModelSettings } from './types';
import { Config } from './types/config';
import { Input, PAGE_FORMAT } from './types/input';

/**
 * Parses the Actor's input into a config object and validates it. Throws an Actor fail if the input is invalid.
 */
export const parseConfiguration = async (input: Input): Promise<Config> => {
    const {
        excludeUrlGlobs,
        includeUrlGlobs,
        initialCookies,
        instructions,
        linkSelector,
        pageFormatInRequest = PAGE_FORMAT.MARKDOWN,
        removeElementsCssSelector,
        saveSnapshots = true,
        skipGptGlobs,
        startUrls,
        targetSelector,
    } = input;

    const model = getModelByName(input.model);
    if (!model) throw await Actor.fail(`Model ${input.model} is not supported`);

    const schema = await parseSchemaConfig(input, model);

    const modelSettings = await parseOpenaiModelSettings(input);

    if (initialCookies) await validateInitialCookies(initialCookies);

    const proxyConfiguration = await Actor.createProxyConfiguration(input.proxyConfiguration);

    const requestList = await RequestList.open('start-urls', startUrls);
    const kvStore = await KeyValueStore.open();

    // make sure to change 0 (unlimited) to a very high number, because this is used in arithmetics and comparisons
    const maxCrawlingDepth = input.maxCrawlingDepth || 999999;
    const maxPagesPerCrawl = input.maxPagesPerCrawl || 999999;

    return {
        excludeUrlGlobs,
        includeUrlGlobs,
        initialCookies,
        instructions,
        kvStore,
        linkSelector,
        maxCrawlingDepth,
        maxPagesPerCrawl,
        model,
        modelSettings,
        pageFormat: pageFormatInRequest,
        proxyConfiguration,
        removeElementsCssSelector,
        requestList,
        saveSnapshots,
        schema,
        skipGptGlobs,
        targetSelector,
    };
};

/**
 * Css selectors need to be validated in the browser context. We do the validation on the first page.
 */
export const validateInputCssSelectors = async (config: Config, page: Page) => {
    const { linkSelector, targetSelector, removeElementsCssSelector } = config;

    await validateInputCssSelector(linkSelector, 'linkSelector', page);
    await validateInputCssSelector(targetSelector, 'targetSelector', page);
    await validateInputCssSelector(removeElementsCssSelector, 'removeElementsCssSelector', page);
};

const parseSchemaConfig = async (input: Input, model: OpenAIModelHandler) => {
    const modelSupportsSchema = model.modelConfig.interface === 'chat';
    const useSchema = input.useStructureOutput && input.schema && modelSupportsSchema;
    const schema = useSchema ? await validateSchemaOrFail(input.schema) : undefined;

    const isUnsupportedSchemaModel = input.useStructureOutput && input.schema && !modelSupportsSchema;
    if (isUnsupportedSchemaModel) {
        log.warning(`Schema is not supported for model ${model.modelConfig.modelName}! Ignoring schema.`);
    }

    return schema;
};

/**
 * Parse and validate JSON schema, if valid return it, otherwise failed actor.
 * @param schema
 */
const validateSchemaOrFail = async (schema: AnySchema | undefined): Promise<AnySchema | undefined> => {
    if (!schema) {
        await Actor.fail(
            'Schema is required when using "Use JSON schema to format answer" option. Provide the correct JSON schema or disable this option.',
        );
        return;
    }
    try {
        const validator = new Ajv2020();
        addFormats(validator);
        validator.compile(schema);
        return schema;
    } catch (e: any) {
        log.error(`Schema is not valid: ${e.message}`, { error: e });
        await Actor.fail(
            'Schema is not valid. Go to Actor run log, '
            + 'where you can find error details or disable "Use JSON schema to format answer" option.',
        );
    }
    return undefined;
};

const parseOpenaiModelSettings = async (input: Input): Promise<OpenAIModelSettings> => {
    // OpenAI defaults to 1, but we want the crawlers to be deterministic
    const temperatureOptions = { default: 0, range: { min: 0, max: 2 } };
    const temperature = await parseNumberInRange(input.temperature, 'temperature', temperatureOptions);

    const topPOptions = { default: 1, range: { min: 0, max: 1 } };
    const topP = await parseNumberInRange(input.topP, 'topP', topPOptions);

    const frequencyOptions = { default: 0, range: { min: 0, max: 2 } };
    const frequencyPenalty = await parseNumberInRange(input.frequencyPenalty, 'frequencyPenalty', frequencyOptions);

    const presenceOptions = { default: 0, range: { min: 0, max: 2 } };
    const presencePenalty = await parseNumberInRange(input.presencePenalty, 'presencePenalty', presenceOptions);

    const modelSettings: OpenAIModelSettings = {
        openAIApiKey: input.openaiApiKey,
        temperature,
        topP,
        frequencyPenalty,
        presencePenalty,
    };

    return modelSettings;
};

const parseNumberInRange = async (
    property: unknown,
    propertyName: string,
    options: { default: number; range: { min: number; max: number } },
) => {
    const parsedNumber = (await parseStringyNumber(property, propertyName)) ?? options.default;
    await validateNumberInRange(parsedNumber, propertyName, options.range);

    return parsedNumber;
};

const parseStringyNumber = async (property: unknown, propertyName: string) => {
    if (property === undefined || property === null) return null;
    if (typeof property === 'string') {
        const parsedNumber = parseFloat(property);
        if (!Number.isNaN(parsedNumber)) return parsedNumber;
    }

    throw await Actor.fail(`INVALID INPUT: '${propertyName}' must be a stringy number! Got '${property}'`);
};

const validateNumberInRange = async (property: number, propertyName: string, range: { min: number; max: number }) => {
    if (property >= range.min && property <= range.max) return true;

    throw await Actor.fail(
        `INVALID INPUT: '${propertyName}' must be in range between ${range.min} and ${range.max}! Got '${property}'`,
    );
};

/**
 * Very basic validation of the initial cookies. We can't do a full cookie validation here.
 * - We do the full validation in `initialCookiesHook` with a browser from crawling context.
 */
const validateInitialCookies = async (cookies: unknown): Promise<Cookie[]> => {
    if (!Array.isArray(cookies)) throw await Actor.fail(`INVALID INPUT: 'initialCookies' must be an array!`);

    if (!cookies.every((cookie) => typeof cookie === 'object')) {
        throw await Actor.fail(`INVALID INPUT: 'initialCookies' must be an array of Cookie objects!`);
    }

    return cookies as Cookie[];
};

const validateInputCssSelector = async (selector: string | undefined | null, inputName: string, page: Page) => {
    if (selector === undefined || selector === null) return;

    try {
        await page.$(selector);
    } catch (e) {
        throw await Actor.fail(`INVALID INPUT: '${inputName}' is not a valid CSS selector! Got '${selector}'`);
    }
};
